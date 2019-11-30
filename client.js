
const {Serialize} = require('eosjs');
const net = require('net');
const fetch = require('node-fetch');

const {concatenate} = require('./utils');
const {abi, types} = require('./net-protocol');


class EOSIOP2PClient {
    constructor({host, port, api}){
        this.host = host;
        this.port = port;
        this.api = api;
        this.current_buffer = new Uint8Array();
        this.my_info;  // state of current node
        this.client;
        this.abi = abi;
        this.types = types;

        setInterval(this.process_queue.bind(this), 50);
    }

    debug_message([type, type_name, data]){
        try {
            console.log(`<<< Type : ${type_name} (${type})`);
            // do not debug blocks or transactions
            if (type < 7){
                console.log(data);
            }
        }
        catch (e){
            console.error(`Failed to deserialize`, e);
            console.error(type, type_name, data);
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
            const self = this;
            this.client.connect(this.port, this.host, function() {
                console.log('Connected to p2p');

                self.client.on('data', (data) => {
                    // put everything on a queue buffer and then process that according to the protocol
                    self.current_buffer = concatenate(self.current_buffer, data);
                });

                resolve(self.client);
            });
        });
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
            throw new Error(`Unknown type "${type}"`);
        }

        return [type, type_name, types.get(type_name).deserialize(sb)];
    }

    async send_message(msg, type){
        const sb = new Serialize.SerialBuffer({
            textEncoder: new TextEncoder,
            textDecoder: new TextDecoder
        });

        // put the message into a serialbuffer
        const msg_types = abi.variants[0].types;
        types.get(msg_types[type]).serialize(sb, msg);

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

        console.log(`>>> Type : ${msg_types[type]} (${type})`, msg);
        this.client.write(buf);
    }

    async send_handshake(){
        const res = await fetch(`${this.api}/v1/chain/get_info`);
        let info = await res.json();
        this.my_info = await this.get_prev_info(info, 1000);  // blocks in the past to put my state
        info = this.my_info;

        const msg = {
            "network_version": 1207,
            "chain_id": info.chain_id,
            "node_id": '0000000000000000000000000000000000000000000000000000000000000001',
            "key": 'PUB_K1_11111111111111111111111111111111149Mr2R',
            "time": '1574986199433946000',
            "token": '0000000000000000000000000000000000000000000000000000000000000000',
            "sig": 'SIG_K1_111111111111111111111111111111111111111111111111111111111111111116uk5ne',
            "p2p_address": 'dangermouse:9876 - a6f45b4',
            "last_irreversible_block_num": info.last_irreversible_block_num,
            "last_irreversible_block_id": info.last_irreversible_block_id,
            "head_num": info.head_block_num,
            "head_id": info.head_block_id,
            "os": 'linux'.repeat(100000),
            "agent": 'Dream Ghost',
            "generation": 1
        };

        // while (true){
            this.send_message(msg, 0);
        // }

    }


    process_queue(){
        // read length of the first message
        let current_length = 0;
        for (let i=0;i<4;i++){
            current_length |= this.current_buffer[i] << (i * 8);
        }
        current_length += 4;

        if (current_length <= this.current_buffer.length){
            // console.log(`Read queue ${current_length} from buffer ${current_buffer.length}`);

            const msg_data = this.deserialize_message(this.current_buffer.slice(0, current_length));

            this.debug_message(msg_data);
            this.process_message(msg_data);

            this.current_buffer = this.current_buffer.slice(current_length);
        }
    }

    process_message([type, type_name, msg]){
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



module.exports = { EOSIOP2PClient };
