
const stream = require('stream');
const {Serialize} = require('eosjs');
const {abi, types} = require('../net-protocol');

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


module.exports = EOSIOStreamDeserializer;
