/*
Net protocol message types
 */

class OrderedChecksum {
    public mode: number;
    public pending: number;
    public ids: string[];
}

export class NetMessage {
    constructor(){}

    copy(data: object){
        for (var p in data){
            this[p] = data[p];
        }
    }
}

export class HandshakeMessage extends NetMessage {
    public network_version: number;
    public chain_id: string;
    public node_id: string;
    public key: string;
    public time: string;
    public token: string;
    public sig: string;
    public p2p_address:string;
    public last_irreversible_block_num: number;
    public last_irreversible_block_id: string;
    public head_num: number;
    public head_id: string;
    public os: string;
    public agent: string;
    public generation: number;
}


export class ChainSizeMessage extends NetMessage {
    public last_irreversible_block_num: number;
    public last_irreversible_block_id: string;
    public head_num: number;
    public head_id: string;
}

export class GoAwayMessage extends NetMessage {
    public reason: number;
    public node_id: string;
}

export class TimeMessage extends NetMessage {
    public org: BigInt;
    public rec: BigInt;
    public xmt: BigInt;
    public dst: BigInt;
}

export class NoticeMessage extends NetMessage {
    public known_trx: OrderedChecksum;
    public known_blocks: OrderedChecksum;
}

export class RequestMessage extends NetMessage {
    public req_trx: OrderedChecksum;
    public req_blocks: OrderedChecksum;
}

export class SyncRequestMessage extends NetMessage {
    public start_block: number;
    public end_block: number;
}
