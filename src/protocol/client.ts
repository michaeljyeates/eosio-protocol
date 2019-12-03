import * as net from 'net';
const fetch = require('node-fetch');
import * as EventEmitter from 'events';
import * as stream from 'stream';

import { NetProtocol } from './net-protocol';
import { NetMessage, HandshakeMessage } from './messages';
import { EOSIOStreamSerializer } from './stream/serializer';
import { EOSIOP2PClientConnection } from './connection';
import { EOSIOStreamConsoleDebugger } from './stream/debugger';
import {EOSIOStreamTokenizer} from "./stream/tokenizer";
import {EOSIOStreamDeserializer} from "./stream/deserializer";


/*
Node implementation (work in progress)
 */

export class EOSIOSharedState {
    public chain_id: string;
    public head_block_num: number;
    public head_block_id: string;
    public last_irreversible_block_num: number;
    public last_irreversible_block_id: string;

    private json(){
        return {
            chain_id: this.chain_id,
            head_block_num: this.head_block_num,
            head_block_id: this.head_block_id,
            last_irreversible_block_num: this.last_irreversible_block_num,
            last_irreversible_block_id: this.last_irreversible_block_id,
        };
    }

    load(){}

    save(){}

    get(){
        return this.json();
    }
}

export class EOSIOP2PClient extends EOSIOP2PClientConnection {
    private current_buffer: Uint8Array;
    private api: string;
    public my_info: any;
    private types: any;

    constructor({host, port, api, debug}){
        super({host, port, api, debug});
        this.api = api;
        this.current_buffer = new Uint8Array();
        this.my_info;  // state of current node
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


}



