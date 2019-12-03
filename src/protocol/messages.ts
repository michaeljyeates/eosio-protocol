/*
Net protocol message types

   using net_message = static_variant<handshake_message,
                                      chain_size_message,
                                      go_away_message,
                                      time_message,
                                      notice_message,
                                      request_message,
                                      sync_request_message,
                                      signed_block,         // which = 7
                                      packed_transaction>;  // which = 8
 */

class OrderedChecksum {
    public mode: number;
    public pending: number;
    public ids: string[];
}

export class NetMessage {
    public type_name = '';
    public type = -1;

    constructor(){}

    copy(data: object){
        for (var p in data){
            this[p] = data[p];
        }
    }

    static from(type: number): NetMessage {
        switch (type){
            case 0:
                return new HandshakeMessage();
                break;
            case 1:
                return new ChainSizeMessage();
                break;
            case 2:
                return new GoAwayMessage();
                break;
            case 3:
                return new TimeMessage();
                break;
            case 4:
                return new NoticeMessage();
                break;
            case 5:
                return new RequestMessage();
                break;
            case 6:
                return new SyncRequestMessage();
                break;
            case 7:
                return new SignedBlockMessage();
                break;
            case 8:
                return new PackedTransactionMessage();
                break;
            default:
                throw new Error(`Unknown message type ${type}`);
        }
    }

}

export class HandshakeMessage extends NetMessage {
    public type_name = 'handshake_message';
    public type = 0;

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
    public type_name = 'chain_size_message';
    public type = 1;

    public last_irreversible_block_num: number;
    public last_irreversible_block_id: string;
    public head_num: number;
    public head_id: string;
}

export class GoAwayMessage extends NetMessage {
    public type_name = 'go_away_message';
    public type = 2;

    static reasons: string[] = [
        'no reason',
        'self connect',
        'duplicate',
        'wrong chain',
        'wrong version',
        'chain is forked',
        'unlinkable block received',
        'bad transaction',
        'invalid block',
        'authentication failure',
        'some other failure',
        'some other non-fatal condition'
    ];

    public reason: number;
    public node_id: string;
}

export class TimeMessage extends NetMessage {
    public type_name = 'time_message';
    public type = 3;

    public org: BigInt;
    public rec: BigInt;
    public xmt: BigInt;
    public dst: BigInt;
}

export class NoticeMessage extends NetMessage {
    public type_name = 'notice_message';
    public type = 4;

    static modes: string[] = [
        'none',
        'catch up',
        'lib catch up',
        'normal'
    ];

    public known_trx: OrderedChecksum;
    public known_blocks: OrderedChecksum;
}

export class RequestMessage extends NetMessage {
    public type_name = 'request_message';
    public type = 5;

    public req_trx: OrderedChecksum;
    public req_blocks: OrderedChecksum;
}

export class SyncRequestMessage extends NetMessage {
    public type_name = 'sync_request_message';
    public type = 6;

    public start_block: number;
    public end_block: number;
}

export class SignedBlockMessage extends NetMessage {
    public type_name = 'signed_block';
    public type = 7;

    public timestamp: string;
    public producer: string;
    public confirmed: number;
    public previous: string;
    public transaction_mroot: string;
    public action_mroot: string;
    public schedule_version: number;
    public new_producers: any[];
    public header_extensions: any[];
    public producer_signature: string;
    public transactions: any[];
    public block_extensions: any[];
}

export class PackedTransactionMessage extends NetMessage {
    public type_name = 'packed_transaction';
    public type = 8;

    public signatures: string[];
    public compression: boolean;
    public packed_context_free_data: string;
    public packed_trx: string;
}
