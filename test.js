
const { EOSIOStreamDeserializer, EOSIOStreamTokenizer, EOSIOP2PClient } = require('./protocol/client');
const {sleep} = require('./includes/utils');

const pron = require('./includes/pron');
const config = require('./node-config');



class TestRunner {
    constructor(node){
        this.node = node;
        this.last_block_time = 0;
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
    constructor(node){
        super(node);
    }

    async on_signed_block(msg) {
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

    async on_error(e){
        // console.error(`Received error`, e);
        this.killed = true;
        this.killed_reason = e.code;
        this.killed_detail = (e + '').replace('Error: ', '');
    }

    log_results(results){
        console.log(results);
    }

    async run(debug = false){
        this.kill_timer = setTimeout(this.kill.bind(this), this.block_timeout);

        const num_blocks = 5000;

        const p2p = new EOSIOP2PClient({...this.node, ...{debug}});

        try {
            const client = await p2p.connect();
            // client.pipe(process.stdout);
            client
                .pipe(new EOSIOStreamTokenizer({}))
                .pipe(new EOSIOStreamDeserializer({}))
                .on('data', (obj) => {
                    if (obj[0] === 7){
                        // console.log(`Received block `);
                        this.on_signed_block(obj[2]);
                    }
                });

            await p2p.send_handshake({msg: {p2p_address: `dreamghost::${pron[0]} - a6f45b4`}, num: num_blocks});

            // get 500 blocks before lib
            await p2p.send_message({start_block: p2p.my_info.last_irreversible_block_num, end_block: p2p.my_info.last_irreversible_block_num + num_blocks}, 6);
        }
        catch (e){
            console.error(e);
        }

        const results = await this.wait_for_tests(num_blocks);
        p2p.disconnect();

        this.log_results(results);
    }

    async get_result_json(){
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
        let sum_b = 0n;
        if (raw.latencies.length > 0){
            sum = raw.latencies.reduce((previous, current) => current += previous);
            sum_b = BigInt(sum_b);
            avg = sum / raw.latencies.length;
        }

        const ns_divisor = Math.pow(10, 9);
        const total_time = sum / ns_divisor;
        const blocks_per_ns = raw.block_count / sum;
        let speed = (blocks_per_ns * ns_divisor).toFixed(10);
        if (isNaN(speed)){
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

    async wait_for_tests(num){
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

    kill(){
        this.killed = true;
        this.killed_reason = 'timeout';
        this.killed_detail = 'Timed out while receiving blocks';
    }
}


const run_tests = async (nodes, network) => {
    for (let n=0;n<nodes[network].length;n++){
        const node = nodes[network][n]
        console.log(`Running tests for ${node.name} (${node.host}:${node.port})`);

        const runner = new BlockTransmissionTestRunner(node);
        await runner.run(debug);
    }
};

const network = 'jungle';
const debug = false;

run_tests(config, network);
// setInterval(run_tests, 60*2*1000, [config, network]);
