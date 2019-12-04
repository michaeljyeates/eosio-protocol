const sha256 = require('sha256');
import * as stream from 'stream';
import {
    GoAwayMessage,
    NetMessage,
    TimeMessage,
    NoticeMessage,
    RequestMessage,
    SyncRequestMessage,
    SignedBlockMessage, PackedTransactionMessage
} from "../messages";
import {Serialize} from "eosjs/dist";


/*
Debugging stream

Writable stream which takes the object output from EOSIOStreamDeserializer and logs it to the console in a compact format
 */

export class EOSIOStreamConsoleDebugger extends stream.Writable {
    private prefix: string;
    private client_identifier: string = '';

    constructor(options: any){
        super({objectMode: true});
        this.prefix = options.prefix || '';
    }

    _write(chunk: any, encoding: string, callback: (error?: (Error | null)) => void): void {
        const msg = NetMessage.from(chunk[0]);
        msg.copy(chunk[2]);

        const prefix = `${this.prefix}  [${chunk[1]}]`;

        let log_msg: string = '';

        switch (chunk[1]){
            case 'handshake_message':
                log_msg = `handshake from ${chunk[2].p2p_address}`;
                this.client_identifier = chunk[2].p2p_address;
                break;
            case 'time_message':
                const t_msg = <TimeMessage>msg;
                log_msg = `time message dst: ${t_msg.dst}, org: ${t_msg.org}, rec: ${t_msg.rec}, xmt: ${t_msg.xmt}`;
                break;
            case 'go_away_message':
                const ga_msg = <GoAwayMessage>msg;
                let reason = GoAwayMessage.reasons[ga_msg.reason];
                log_msg = `go away message ${reason}`;
                break;
            case 'notice_message':
                const n_msg = <NoticeMessage>msg;
                const notice_mode = NoticeMessage.modes[n_msg.known_blocks.mode];
                // log_msg = n_msg);
                if (notice_mode === 'normal'){
                    log_msg = `notice message, remote server is ${n_msg.known_blocks.pending} blocks ahead`;
                }
                else {
                    log_msg = `${notice_mode} notice message, lib : ${n_msg.known_trx.pending}, head ${n_msg.known_blocks.pending}`;
                }
                break;
            case 'request_message':
                const r_msg = <RequestMessage>msg;
                log_msg = `request message`;
                break;
            case 'sync_request_message':
                const sr_msg = <SyncRequestMessage>msg;
                log_msg = `sync request message`;
                break;
            case 'signed_block':
                const sb_msg = <SignedBlockMessage>msg;
                const block_num_hex = sb_msg.previous.substr(0, 8); // first 64 bits
                const block_num = parseInt(block_num_hex, 16) + 1;
                log_msg = `#${block_num} signed by ${sb_msg.producer}`;
                break;
            case 'packed_transaction':
                const pt_msg = <PackedTransactionMessage>msg;
                const trx_bin = Serialize.hexToUint8Array(pt_msg.packed_trx);
                const trx_id = sha256(trx_bin);
                log_msg = `Transaction ${trx_id}`;
                break;
        }

        if (!log_msg){
            console.log('Unknown chunk', chunk);
        }
        else {
            console.log(`${prefix} - ${this.client_identifier} ${log_msg}`);
        }

        callback();
    }
}