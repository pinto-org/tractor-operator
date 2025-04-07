import { ethers } from "ethers";
import * as dotenv from "dotenv";
import {
	loadPublishedRequisitions,
	SOW_BLUEPRINT_V0_ADDRESS,
	findOperatorPlaceholderOffset,
} from "./tractor-utils";
import type { RequisitionEvent } from "./tractor-utils";

// Load environment variables
dotenv.config();

// Configuration from .env
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CHECK_INTERVAL = Number.parseInt(process.env.CHECK_INTERVAL || "10000");
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS; // Add this to .env.example

// Validate required configuration
if (!RPC_URL) {
	console.error("RPC_URL is required in .env file");
	process.exit(1);
}

if (!PRIVATE_KEY) {
	console.error("PRIVATE_KEY is required in .env file");
	process.exit(1);
}

if (!PROTOCOL_ADDRESS) {
	console.error("PROTOCOL_ADDRESS is required in .env file");
	process.exit(1);
}

// Setup provider and wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Function to check if an action can be executed
async function checkActionCanBeExecuted(): Promise<{
	canExecute: boolean;
	requisition?: RequisitionEvent;
}> {
	try {
		console.log("Checking for available requisitions...");

		// Get the latest block for timing reference
		const latestBlock = await provider.getBlock("latest");
		if (!latestBlock) {
			console.error("Could not fetch latest block");
			return { canExecute: false };
		}

		// Fetch active requisitions of type sowBlueprintv0
		const requisitions = await loadPublishedRequisitions(
			undefined, // Don't filter by publisher
			PROTOCOL_ADDRESS,
			provider,
			{
				number: BigInt(latestBlock.number),
				timestamp: BigInt(latestBlock.timestamp),
			},
			"sowBlueprintv0",
		);

		console.log(`Found ${requisitions.length} requisitions`);

		// Filter out cancelled and expired requisitions
		const activeRequisitions = requisitions.filter((req) => {
			if (req.isCancelled) {
				console.log(
					`Requisition ${req.requisition.blueprintHash} is cancelled`,
				);
				return false;
			}

			const now = Date.now();
			const endTime = Number(req.requisition.blueprint.endTime) * 1000;
			if (endTime < now) {
				console.log(
					`Requisition ${req.requisition.blueprintHash} has expired (endTime: ${new Date(endTime).toLocaleString()})`,
				);
				return false;
			}

			const startTime = Number(req.requisition.blueprint.startTime) * 1000;
			if (startTime > now) {
				console.log(
					`Requisition ${req.requisition.blueprintHash} is not active yet (startTime: ${new Date(startTime).toLocaleString()})`,
				);
				return false;
			}

			return true;
		});

		console.log(`Found ${activeRequisitions.length} active requisitions`);

		if (activeRequisitions.length === 0) {
			return { canExecute: false };
		}

		// Check if our address is whitelisted as an operator for any of the requisitions
		const operatorAddress = wallet.address.toLowerCase();

		for (const req of activeRequisitions) {
			if (req.decodedData) {
				const whitelistedOperators =
					req.decodedData.operatorParams.whitelistedOperators;

				// If there are no whitelisted operators, anyone can execute
				if (whitelistedOperators.length === 0) {
					console.log(
						`Requisition ${req.requisition.blueprintHash} has no operator restrictions`,
					);
					return { canExecute: true, requisition: req };
				}

				// Check if our address is in the whitelist
				for (const op of whitelistedOperators) {
					if (op.toLowerCase() === operatorAddress) {
						console.log(
							`Our address is whitelisted for requisition ${req.requisition.blueprintHash}`,
						);
						return { canExecute: true, requisition: req };
					}
				}
			}
		}

		console.log("No requisitions available for our operator address");
		return { canExecute: false };
	} catch (error) {
		console.error("Error checking if action can be executed:", error);
		return { canExecute: false };
	}
}

// Function to execute the action
async function executeAction(requisition: RequisitionEvent): Promise<void> {
	try {
		console.log(
			"Executing action for requisition:",
			requisition.requisition.blueprintHash,
		);
		console.log(`Using wallet address: ${wallet.address}`);

		// Create a contract to interact with
		const protocolAddress = PROTOCOL_ADDRESS as string; // Type assertion since we already validated it exists
		const contract = new ethers.Contract(
			protocolAddress,
			[
				"function tractor(tuple(tuple(address publisher, bytes data, bytes32[] operatorPasteInstrs, uint256 maxNonce, uint256 startTime, uint256 endTime) blueprint, bytes32 blueprintHash, bytes signature) requisition, bytes operatorData) external",
			],
			wallet,
		);

		// Use empty operator data instead of trying to insert the operator address
		const operatorData = "0x";

		// First simulate the transaction to check if it will succeed
		console.log("Simulating transaction...");
		try {
			await contract.tractor.staticCall(requisition.requisition, operatorData, {
				gasLimit: 5000000,
			});
			console.log(
				"Simulation successful! Transaction should execute properly.",
			);
		} catch (error) {
			console.error("Transaction simulation failed:", error);
			console.log("Not sending the transaction to avoid wasting gas.");
			return;
		}

		// If simulation was successful, proceed with the actual transaction
		console.log("Submitting tractor transaction...");
		const tx = await contract.tractor(requisition.requisition, operatorData, {
			gasLimit: 5000000, // Add some extra gas just to be safe
		});

		console.log(`Transaction submitted: ${tx.hash}`);
		console.log("Waiting for transaction confirmation...");

		const receipt = await tx.wait();
		console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
		console.log("Action executed successfully");
	} catch (error) {
		console.error("Error executing action:", error);
	}
}

// Main monitoring function
async function monitor(): Promise<void> {
	console.log("Monitoring started...");

	try {
		const { canExecute, requisition } = await checkActionCanBeExecuted();

		if (canExecute && requisition) {
			console.log("Action can be executed, proceeding...");
			await executeAction(requisition);
		} else {
			console.log("Action cannot be executed at this time");
		}
	} catch (error) {
		console.error("Error in monitoring cycle:", error);
	}

	// Schedule the next check
	setTimeout(monitor, CHECK_INTERVAL);
}

// Start the monitoring process
console.log(`Bot starting with check interval of ${CHECK_INTERVAL}ms`);
console.log(`Wallet address: ${wallet.address}`);
monitor().catch((error) => {
	console.error("Fatal error in monitoring process:", error);
	process.exit(1);
});
