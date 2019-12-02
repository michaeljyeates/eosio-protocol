
const {Serialize} = require('eosjs');
const net = require('net');
const fetch = require('node-fetch');
const EventEmitter = require('events');
const stream = require('stream');

const {concatenate} = require('./utils');
const {abi, types} = require('./net-protocol');

class EOSIOStreamSerializer extends stream.Transform {
    constructor(options){
        super({writableObjectMode:true, readableObjectMode:true});
    }

    _transform(data, encoding, callback){
        try {
            // console.log(`transform`, data);
            const msg = this.serialize_message(data);

            if (msg){
                this.push(msg);
            }

            callback();
        }
        catch (e){
            this.destroy(`Failed to serialize`);
            console.error(e);
            callback(`Failed to serialize`);
        }
    }

    serialize_message([type, type_name, data]){

        const sb = new Serialize.SerialBuffer({
            textEncoder: new TextEncoder,
            textDecoder: new TextDecoder
        });

        // put the message into a serialbuffer
        const msg_types = abi.variants[0].types;
        types.get(msg_types[type]).serialize(sb, data);

        const len = sb.length;
        // console.log(`${msg_types[type]} buffer is ${len} long`);

        // Append length and msg type
        const header = new Serialize.SerialBuffer({
            textEncoder: new TextEncoder,
            textDecoder: new TextDecoder
        });
        header.pushUint32(len + 1);
        header.push(type); // message type

        const buf = Buffer.concat([Buffer.from(header.asUint8Array()), Buffer.from(sb.asUint8Array())]);

        return buf;
    }
}

class EOSIOStreamDeserializer extends stream.Transform {
    constructor(options){
        super({readableObjectMode:true});
    }

    _transform(data, encoding, callback){
        try {
            const msg = this.deserialize_message(data);

            if (msg){
                this.push(msg);
            }

            callback();
        }
        catch (e){
            this.destroy(`Failed to deserialize`);
            console.error(e);
            callback(`Failed to deserialize`);
        }
    }

    deserialize_message(array){
        const sb = new Serialize.SerialBuffer({
            textEncoder: new TextEncoder,
            textDecoder: new TextDecoder,
            array
        });

        const len = sb.getUint32();
        const type = sb.get();
        const msg_types = abi.variants[0].types;
        const type_name = msg_types[type];

        if (typeof type_name === 'undefined'){
            throw new Error(`Unknown message type "${type}" while deserializing`);
        }

        return [type, type_name, types.get(type_name).deserialize(sb)];
    }

}


class EOSIOStreamTokeniser extends stream.Transform {
    constructor(options){
        // options.objectMode = true;
        options.highWaterMark = 65000000000;
        super(options);

        this.array = new Uint8Array();
        this.buffer = [];
        this.readable = false;
        this.writable = true;
    }

    _transform(data, encoding, callback){
        // console.log(data);
        if (encoding !== 'buffer'){
            console.log('Received UTF8');
            // throw new Error(`Incorrect buffer encoding ${encoding}`);
        }

        this.array = concatenate(this.array, data);

        // console.log(`Stream write`, this.array.length);

        let msg_data;
        while (msg_data = this.process()){
            this.buffer.push(msg_data);
        }

        let item;
        while (item = this.buffer.shift()){
            this.push(item);
        }

        this.readable = (this.buffer.length > 0);

        this.writable = true;

        callback();

        return false;
    }

    _flush(callback){
        callback();
    }

    process(){
        // read length of the first message
        let current_length = 0;
        for (let i=0;i<4;i++){
            current_length |= this.array[i] << (i * 8);
        }
        current_length += 4;

        let msg_data = null;

        // console.log(`Processing with length ${current_length}`);

        if (current_length <= this.array.length){
            // console.log(`Read queue ${current_length} from buffer ${this.array.length}`);

            // console.log(this.deserialize_message(this.array.slice(0, current_length)));
            msg_data = this.array.slice(0, current_length);

            this.array = this.array.slice(current_length);
            // console.log(`Length now ${this.array.length}`);
        }

        return msg_data;
    }

}


class EOSIOP2PClient extends EventEmitter {
    constructor({host, port, api, debug}){
        super();
        this.host = host;
        this.port = port;
        this.api = api;
        this.current_buffer = new Uint8Array();
        this.my_info;  // state of current node
        this.client;
        this.abi = abi;
        this.types = types;
        this._debug = debug;
    }

    debug(...msg){
        if (this._debug){
            console.log(...msg);
        }
    }

    error(msg){
        console.error(msg);
    }

    debug_message([type, type_name, data]){
        try {
            this.debug(`<<< Type : ${type_name} (${type})`);
            // do not debug blocks or transactions
            if (type < 7){
                this.debug(data);
            }
        }
        catch (e){
            this.error(`Failed to deserialize`, e);
            this.error(type, type_name, data);
        }
    }

    async get_block_id(block_num_or_id){
        const res = await fetch(`${this.api}/v1/chain/get_block`, {
            method: 'POST',
            body: JSON.stringify({block_num_or_id})
        });
        const info = await res.json();

        return info.id;
    }

    async get_prev_info(info, num=1000){
        if (num > 0){
            info.head_block_num -= num;
            info.last_irreversible_block_num -= num;
            info.head_block_id = await this.get_block_id(info.head_block_num);
            info.last_irreversible_block_id = await this.get_block_id(info.last_irreversible_block_num);
        }

        return info;
    }

    async connect(){
        return new Promise((resolve, reject) => {
            this.client = new net.Socket();

            this.client.on('error', (e) => {
                this.emit('net_error', e);
                reject(e);
            });
            const self = this;
            this.client.connect(this.port, this.host, function() {
                console.log('Connected to p2p');

                self.emit('connected');

                resolve(self.client);
            });

        });
    }

    disconnect(){
        this.client.end();
        this.client.destroy();
        this.client = null;
    }

    async send_message(msg, type){
        if (!this.client){
            this.error(`Not sending message because we do not have a client`);
            return;
        }

        const msg_types = this.abi.variants[0].types;
        const sr = new stream.Readable({objectMode:true, read() {}});
        sr.push([type, msg_types[type], msg]);

        const write_stream = new EOSIOStreamSerializer({});
        sr.pipe(write_stream).on('data', (d) => {
            this.debug(`>>> `, d);
            this.client.write(d);
        });
    }

    async send_handshake(options = {}){
        const res = await fetch(`${this.api}/v1/chain/get_info`);
        let info = await res.json();
        if (!options.msg || (!options.msg.head_id && !options.msg.last_irreversible_block_id)){
            let num = parseInt(options.num);
            if (isNaN(num)){
                num = 0;
            }
            this.my_info = await this.get_prev_info(info, num);  // blocks in the past to put my state
            info = this.my_info;
        }
        else {
            this.my_info = {...info, ...options.msg};
        }


        let msg = {
            "network_version": 1207,
            "chain_id": info.chain_id,
            "node_id": '0585cab37823404b8c82d6fcc66c4faf20b0f81b2483b2b0f186dd47a1230fdc',
            "key": 'PUB_K1_11111111111111111111111111111111149Mr2R',
            "time": '1574986199433946000',
            "token": '0000000000000000000000000000000000000000000000000000000000000000',
            "sig": 'SIG_K1_111111111111111111111111111111111111111111111111111111111111111116uk5ne',
            "p2p_address": `eosdac-p2p-client:9876 - a6f45b4`,
            "last_irreversible_block_num": info.last_irreversible_block_num,
            "last_irreversible_block_id": info.last_irreversible_block_id,
            "head_num": info.head_block_num,
            "head_id": info.head_block_id,
            "os": 'linux',
            "agent": 'Dream Ghost',
            "generation": 1
        };

        if (options.msg){
            msg = {...msg, ...options.msg};
        }

        this.send_message(msg, 0);
    }

    process_message([type, type_name, msg]){
        this.emit(type_name, msg);
        this.emit('message', type, type_name, msg);

        if (type === 4 && msg.known_blocks.mode === 2){ // notice_message sync lib
            // request blocks from my lib to theirs
            const req_msg = {
                start_block: this.my_info.last_irreversible_block_num,
                end_block: msg.known_trx.pending
            };
            this.send_message(req_msg, 6); //sync_request_message
        }
    }

}



module.exports = { EOSIOStreamSerializer, EOSIOStreamDeserializer, EOSIOStreamTokeniser, EOSIOP2PClient };
