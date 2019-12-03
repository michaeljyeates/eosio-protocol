
import * as stream from 'stream';
const {Serialize} = require('eosjs');
import {NetProtocol} from '../net-protocol';
const { TextDecoder, TextEncoder } = require('util');

/*
Deserializing stream

Transform stream which reads tokenised binary messages from the EOSIOStreamTokenizer
 */

export class EOSIOStreamDeserializer extends stream.Transform {
    constructor(options){
        super({readableObjectMode:true, highWaterMark: 1024 * 1024});
    }

    _transform(data, encoding, callback){
        try {
            const msg = this.deserialize_message(data);

            if (msg){
                // console.log(`Sending from deserializer `, msg);
                this.push(msg);
            }

            callback();
        }
        catch (e){
            this.destroy(new Error(`Failed to deserialize`));
            console.error(e);
            callback(`Failed to deserialize`);
        }
    }

    deserialize_message(array){
        const sb = new Serialize.SerialBuffer({
            textEncoder: new TextEncoder(),
            textDecoder: new TextDecoder(),
            array
        });

        const len = sb.getUint32();
        const type = sb.get();
        const msg_types = NetProtocol.variant_types();
        const type_name = msg_types[type];

        if (typeof type_name === 'undefined'){
            throw new Error(`Unknown message type "${type}" while deserializing`);
        }

        return [type, type_name, NetProtocol.types.get(type_name).deserialize(sb)];
    }

}


