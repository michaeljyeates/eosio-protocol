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

export class EOSIOP2PClientConnection extends EventEmitter {
    protected host: string;
    protected port: number;
    protected client: any;
    protected _debug: boolean;

    constructor({host, port, api, debug}){
        super();
        this.host = host;
        this.port = port;
        this.client = null;
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
                this.error(`Not sending message because we do not have a client`);
            }
        });
    }
}