import * as net from 'net';
const fetch = require('node-fetch');
import * as EventEmitter from 'events';
import * as stream from 'stream';

import { NetProtocol } from './net-protocol';
import { NetMessage, HandshakeMessage } from './messages';
import { EOSIOStreamSerializer } from './stream/serializer';
import { EOSIOStreamConsoleDebugger } from './stream/debugger';
import {EOSIOStreamTokenizer} from "./stream/tokenizer";
import {EOSIOStreamDeserializer} from "./stream/deserializer";


export class EOSIOSharedState {
    private chain_id: string;
    private head_block_num: number;
    private head_block_id: string;
    private last_irreversible_block_num: number;
    private last_irreversible_block_id: string;

    load(){}
    save(){}
}

export class EOSIOP2PClient extends EventEmitter {
    private host: string;
    private current_buffer: Uint8Array;
    private port: number;
    private api: string;
    public my_info: any;
    private client: any;
    private types: any;
    private _debug: boolean;

    constructor({host, port, api, debug}){
        super();
        this.host = host;
        this.port = port;
        this.api = api;
        this.current_buffer = new Uint8Array();
        this.my_info;  // state of current node
        this.client = null;
        this.types = NetProtocol.types;
        this._debug = debug;
    }

    debug(...msg){
        if (this._debug){
            console.log(...msg);
        }
    }

    error(...msg){
        console.error(...msg);
    }

    async get_block_id(block_num_or_id: number|string): Promise<string> {
        const res = await fetch(`${this.api}/v1/chain/get_block`, {
            method: 'POST',
            body: JSON.stringify({block_num_or_id})
        });
        const info = await res.json();

        return info.id;
    }

    async get_prev_info(info: any, num=1000){
        if (num > 0){
            info.head_block_num -= num;
            info.last_irreversible_block_num -= num;
            info.head_block_id = await this.get_block_id(info.head_block_num);
            info.last_irreversible_block_id = await this.get_block_id(info.last_irreversible_block_num);
        }

        return info;
    }

    async connect(): Promise<stream.Stream> {
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

    disconnect(): void {
        this.client.end();
        this.client.destroy();
        this.client = null;
    }

    async send_message(msg: NetMessage, type: number) {
        if (this.client === null){
            this.error(`Not sending message because we do not have a client`);
            return;
        }
        // console.log(this.client);

        const msg_types = NetProtocol.variant_types();
        const sr = new stream.Readable({objectMode:true, read() {}});
        sr.push([type, msg_types[type], msg]);

        const write_stream = new EOSIOStreamSerializer({});
        sr.pipe(write_stream).on('data', (d) => {
            this.debug(`>>> DATA TO CLIENT `, d);
            // console.log(this.client);

            if (this.client){
                this.client.write(d);
            }
            else {
                console.log(`No client`);
            }
        });
    }

    async send_handshake(options: any = {}): Promise<void> {
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


        let msg = new HandshakeMessage();
        msg.copy({
            "network_version": 1206,
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
        });

        if (options.msg){
            msg.copy(options.msg);
        }

        await this.send_message(msg, 0);
    }

    // process_message([type, type_name, msg]){
    //     this.emit(type_name, msg);
    //     this.emit('message', type, type_name, msg);
    //
    //     if (type === 4 && msg.known_blocks.mode === 2){ // notice_message sync lib
    //         // request blocks from my lib to theirs
    //         const req_msg = {
    //             start_block: this.my_info.last_irreversible_block_num,
    //             end_block: msg.known_trx.pending
    //         };
    //         this.send_message(req_msg, 6); //sync_request_message
    //     }
    // }

}



