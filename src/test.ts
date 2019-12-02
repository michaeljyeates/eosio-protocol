
import { EOSIOStreamDeserializer } from './protocol/stream/deserializer';
import { EOSIOStreamTokenizer } from './protocol/stream/tokenizer';
import {HandshakeMessage, SyncRequestMessage} from './protocol/messages';

import { EOSIOP2PClientConnection } from './protocol/client';
import {sleep}  from './includes/utils';

import * as pron from './includes/pron';
import { NodeConfig } from './node-config';
import * as stream from 'stream';
import {EOSIOStreamConsoleDebugger} from "./protocol/stream/debugger";

const fetch = require('node-fetch');


class TestRunner {
    protected last_block_time: bigint;
    protected block_count: number;
    protected node: any;
    protected killed_reason: string;
    protected killed_detail: string;
    protected killed: boolean;
    protected latencies: number[];
    protected block_timeout: number;

    constructor(node){
        this.node = node;
        this.last_block_time = BigInt(0);
        this.block_count = 0;
        this.killed = false;
        this.killed_reason = '';
        this.killed_detail = '';
        this.latencies = [];
        this.block_timeout = 10000;
    }

    run(debug = false){
        console.log(`Test runner doesnt override run`);
    }
}

class BlockTransmissionTestRunner extends TestRunner {
    private kill_timer: NodeJS.Timeout;
    private p2p: EOSIOP2PClientConnection;

    constructor(node){
        super(node);
    }

    async on_signed_block(msg): Promise<void> {
        // console.log('TestRunner:on_signed_block');
        clearTimeout(this.kill_timer);
        this.kill_timer = setTimeout(this.kill.bind(this), this.block_timeout);

        this.block_count++;
        const block_num_hex = msg.previous.substr(0, 8); // first 64 bits
        const block_num = parseInt(block_num_hex, 16) + 1;
        const tm = process.hrtime.bigint();
        if (this.last_block_time > 0){
            const latency = Number(tm - this.last_block_time);
            this.latencies.push(latency);
            // console.log(`Received block : ${block_num} signed by ${msg.producer} with latency ${latency} - ${this.block_count} received from ${this.node.host}`);
        }
        this.last_block_time = tm;
    }

    async on_error(e): Promise<void> {
        // console.error(`Received error`, e);
        this.killed = true;
        this.killed_reason = e.code;
        this.killed_detail = (e + '').replace('Error: ', '');
    }

    log_results(results): void{
        console.log(results);
    }

    async run(debug = false): Promise<void>{
        this.kill_timer = setTimeout(this.kill.bind(this), this.block_timeout);

        const num_blocks = 5000;

        const p2p = new EOSIOP2PClientConnection({...this.node, ...{debug}});
        this.p2p = p2p;

        try {
            const client: stream.Stream = await p2p.connect();
            // client.pipe(process.stdout);

            const deserialized_stream = client
                .pipe(new EOSIOStreamTokenizer({}))
                .pipe(new EOSIOStreamDeserializer({}))
                .on('data', (obj) => {
                    if (obj[0] === 7){
                        // console.log(`Received block `);
                        this.on_signed_block(obj[2]);
                    }
                });


            if (debug){
                deserialized_stream
                    .pipe(new EOSIOStreamConsoleDebugger({prefix: '<<<'}));
            }

            const res = await fetch(`${this.node.api}/v1/chain/get_info`);
            let info = await res.json();

            const prev_info = await this.get_prev_info(info, num_blocks);

            const override = {
                chain_id: info.chain_id,
                p2p_address: `dreamghost::${pron[0]} - a6f45b4`,
                last_irreversible_block_num: prev_info.last_irreversible_block_num,
                last_irreversible_block_id: prev_info.last_irreversible_block_id,
                head_num: prev_info.head_block_num,
                head_id: prev_info.head_block_id,
            };
            await this.send_handshake(override);

            // get num blocks before lib
            const msg = new SyncRequestMessage();
            msg.copy({start_block: prev_info.last_irreversible_block_num, end_block: prev_info.last_irreversible_block_num + num_blocks});
            await p2p.send_message(msg, 6);
        }
        catch (e){
            console.error(e);
        }

        const results = await this.wait_for_tests(num_blocks);
        p2p.disconnect();

        this.log_results(results);
    }


    async get_block_id(block_num_or_id: number|string): Promise<string> {
        const res = await fetch(`${this.node.api}/v1/chain/get_block`, {
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

    async get_result_json(): Promise<Object>{
        const raw = {
            status:'success',
            block_count: this.block_count,
            latencies: this.latencies,
            error_code: this.killed_reason,
            error_detail: this.killed_detail
        };

        raw.status = (!this.killed_reason)?'success':'error';

        let avg = 0;
        let sum = 0;
        let sum_b = BigInt(0);
        if (raw.latencies.length > 0){
            sum = raw.latencies.reduce((previous, current) => current += previous);
            sum_b = BigInt(sum_b);
            avg = sum / raw.latencies.length;
        }

        const ns_divisor = Math.pow(10, 9);
        const total_time = sum / ns_divisor;
        const blocks_per_ns = raw.block_count / sum;
        let speed = (blocks_per_ns * ns_divisor).toFixed(10);
        if (speed === 'NaN'){
            speed = '';
        }

        const results = {
            bp_name         : this.node.bp_name,
            name            : this.node.name,
            host            : `${this.node.host}:${this.node.port}`,
            status          : raw.status,
            error_code      : raw.error_code,
            error_detail    : raw.error_detail,
            blocks_received : raw.block_count,
            total_test_time : total_time,
            speed           : speed
        };

        return results;
    }

    async wait_for_tests(num) {
        return new Promise(async (resolve, reject) => {
            while (true){
                // console.log(`Checking success for ${this.node.name}`);
                process.stdout.write(`.`);
                if (this.block_count >= num){
                    clearTimeout(this.kill_timer);
                    resolve(this.get_result_json());
                    break;
                }

                if (this.killed){
                    clearTimeout(this.kill_timer);
                    resolve(this.get_result_json());
                    break;
                }

                await sleep(1000);
            }

        });
    }

    kill(): void{
        this.killed = true;
        this.killed_reason = 'timeout';
        this.killed_detail = 'Timed out while receiving blocks';
    }

    private async send_handshake(override) {

        let msg = new HandshakeMessage();
        msg.copy({
            "network_version": 1206,
            "chain_id": '0000000000000000000000000000000000000000000000000000000000000000', // should be o
            "node_id": '0585cab37823404b8c82d6fcc66c4faf20b0f81b2483b2b0f186dd47a1230fdc',
            "key": 'PUB_K1_11111111111111111111111111111111149Mr2R',
            "time": '1574986199433946000',
            "token": '0000000000000000000000000000000000000000000000000000000000000000',
            "sig": 'SIG_K1_111111111111111111111111111111111111111111111111111111111111111116uk5ne',
            "p2p_address": `eosdac-p2p-client:9876 - a6f45b4`,
            "last_irreversible_block_num": 0,
            "last_irreversible_block_id": '0000000000000000000000000000000000000000000000000000000000000000',
            "head_num": 0,
            "head_id": '0000000000000000000000000000000000000000000000000000000000000000',
            "os": 'linux',
            "agent": 'Dream Ghost',
            "generation": 1
        });

        if (override){
            msg.copy(override);
        }

        await this.p2p.send_message(msg, 0);
    }
}


const run_tests = async (nodes: any, network: string) => {
    for (let n=0;n<nodes[network].length;n++){
        const node = nodes[network][n];
        console.log(`Running tests for ${node.name} (${node.host}:${node.port})`);

        const runner = new BlockTransmissionTestRunner(node);
        await runner.run(debug);
    }
};

const network = 'jungle';
const debug = true;

run_tests(NodeConfig, network);
// setInterval(run_tests, 60*2*1000, [config, network]);
