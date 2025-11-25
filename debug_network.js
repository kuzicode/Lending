require('dotenv').config();
const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL;
const POOL_ADDRESS = '0x87870bca3f3fd6335c3f4ce8392d6d0895df8fc8'; // Pool contract

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    try {
        const network = await provider.getNetwork();
        console.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

        const code = await provider.getCode(POOL_ADDRESS);
        console.log(`Code at Pool (${POOL_ADDRESS}): ${code.slice(0, 10)}... (Length: ${code.length})`);

        if (code === '0x') {
            console.error("ERROR: No code found at address!");
        } else {
            console.log("SUCCESS: Contract code found.");
        }
    }
    catch (error) {
        console.error("Error:", error);
    }
}

main();
