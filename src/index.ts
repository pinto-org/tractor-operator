import { ethers } from "ethers";
import * as dotenv from "dotenv";
import {
	loadPublishedRequisitions,
	SOW_BLUEPRINT_V0_ADDRESS,
	findOperatorPlaceholderOffset,
	getEthUsdPrice,
	getPintoUsdPrice,
} from "./tractor-utils";
import type { RequisitionEvent } from "./tractor-utils";

// Load environment variables
dotenv.config();

// Configuration from .env
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CHECK_INTERVAL = Number.parseInt(process.env.CHECK_INTERVAL || "10000");
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS; // Add this to .env.example
const EXECUTION_MODE = process.env.EXECUTION_MODE || "preview"; // Default to preview mode

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

// Update the simulation results type to be more specific and consistent
type SimulationResult = {
	requisition: RequisitionEvent;
	success: boolean;
	error: string | null;
	gasEstimate?: number;
	gasCostEth?: number;
	gasCostUsd?: number;
	operatorTip?: string;
	operatorTipUsd?: number;
	estimatedProfitUsd?: number;
};

// Function to check if an action can be executed
async function checkForExecutableRequisitions(): Promise<{
	canExecute: boolean;
	requisition?: RequisitionEvent;
	executableRequisitions: SimulationResult[];
}> {
	try {
		console.log("Checking for available requisitions...");

		// Get the latest block for timing reference
		const latestBlock = await provider.getBlock("latest");
		if (!latestBlock) {
			console.error("Could not fetch latest block");
			return { canExecute: false, executableRequisitions: [] };
		}

		// Fetch ETH/USD price once at the beginning
		let ethUsdPrice = 0;
		try {
			ethUsdPrice = await getEthUsdPrice(provider);
			console.log(`Current ETH/USD price: $${ethUsdPrice.toFixed(6)}`);
		} catch (priceError) {
			console.error("Failed to fetch ETH/USD price:", priceError);
			// Continue without USD price if fetching fails
		}

		// Fetch Pinto/USD price once at the beginning
		let pintoUsdPrice = 0;
		try {
			pintoUsdPrice = await getPintoUsdPrice(provider);
			console.log(`Current Pinto/USD price: $${pintoUsdPrice.toFixed(6)}`);
		} catch (priceError) {
			console.error("Failed to fetch Pinto/USD price:", priceError);
			// Continue without Pinto price if fetching fails
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
			return { canExecute: false, executableRequisitions: [] };
		}

		// Display information about each active requisition
		activeRequisitions.forEach((req, index) => {
			console.log(`Requisition ${index + 1}:`);
			console.log(`  Publisher: ${req.requisition.blueprint.publisher}`);
			console.log(`  Blueprint Hash: ${req.requisition.blueprintHash}`);
			console.log(`  Is Cancelled: ${req.isCancelled}`);
			console.log(`  Type: ${req.decodedData ? "sowBlueprintv0" : "unknown"}`);
			console.log(
				`  Start Time: ${new Date(Number(req.requisition.blueprint.startTime) * 1000).toLocaleString()}`,
			);
			console.log(
				`  End Time: ${new Date(Number(req.requisition.blueprint.endTime) * 1000).toLocaleString()}`,
			);
		});

		// Create a contract to interact with
		const protocolAddress = PROTOCOL_ADDRESS as string;
		const contract = new ethers.Contract(
			protocolAddress,
			[
				"function tractor(tuple(tuple(address publisher, bytes data, bytes32[] operatorPasteInstrs, uint256 maxNonce, uint256 startTime, uint256 endTime) blueprint, bytes32 blueprintHash, bytes signature) requisition, bytes operatorData) external",
			],
			wallet,
		);

		// Then rewrite the simulation part
		console.log("\nSimulating execution for each requisition:");
		const simulationResults = await Promise.all(
			activeRequisitions.map(async (req, index) => {
				const operatorData = "0x";
				console.log(
					`\nSimulating requisition ${index + 1} (${req.requisition.blueprintHash})...`,
				);

				const result: SimulationResult = {
					requisition: req,
					success: false,
					error: null,
				};

				// Extract operator tip amount (in Pinto) early
				if (req.decodedData?.operatorParams?.operatorTipAmount) {
					result.operatorTip =
						req.decodedData.operatorParams.operatorTipAmount.toString();
					console.log(
						`  Operator tip for requisition ${req.requisition.blueprintHash}: ${result.operatorTip} Pinto`,
					);
				}

				// Step 1: Try simulation
				try {
					await contract.tractor.staticCall(req.requisition, operatorData);
					console.log(`✅ Simulation SUCCESSFUL for requisition ${index + 1}`);
					result.success = true;

					// Step 2: Try gas estimation
					try {
						const gasEstimate = await contract.tractor.estimateGas(
							req.requisition,
							operatorData,
						);

						const gasEstimateNumber = Number(gasEstimate);
						console.log(`   Gas estimate: ${gasEstimateNumber}`);
						result.gasEstimate = gasEstimateNumber;

						// Step 3: Try to get fee data and calculate ETH cost
						try {
							const feeData = await provider.getFeeData();
							if (feeData.gasPrice) {
								const gasPriceGwei = Number(feeData.gasPrice) / 1e9;
								const gasCostEth =
									(gasEstimateNumber * Number(feeData.gasPrice)) / 1e18;
								console.log(`   Gas price: ${gasPriceGwei.toFixed(2)} Gwei`);
								console.log(`   Estimated cost: ${gasCostEth.toFixed(6)} ETH`);
								result.gasCostEth = gasCostEth;

								// Step 4: Calculate USD cost using pre-fetched ETH/USD price
								if (result.gasCostEth && ethUsdPrice > 0) {
									const usdCost = result.gasCostEth * ethUsdPrice;
									console.log(`   Estimated cost: $${usdCost.toFixed(6)} USD`);
									result.gasCostUsd = usdCost;

									// Calculate USD value of tip if we have the price
									if (pintoUsdPrice > 0) {
										const tipPinto = Number(result.operatorTip) / 1e6; // Convert from Pinto units (6 decimals)
										const tipUsd = tipPinto * pintoUsdPrice;
										result.operatorTipUsd = tipUsd;
										console.log(
											`  Operator tip value: $${tipUsd.toFixed(6)} USD`,
										);

										// If we have gas cost in USD, calculate estimated profit
										if (result.gasCostUsd) {
											const profitUsd = tipUsd - result.gasCostUsd;
											result.estimatedProfitUsd = profitUsd;
											console.log(
												`  Estimated profit: $${profitUsd.toFixed(6)} USD ${profitUsd >= 0 ? "✅ PROFITABLE" : "❌ LOSS"}`,
											);
										}
									}
								}
							}
						} catch (feeError) {
							console.log(
								`   Could not retrieve gas price: ${feeError instanceof Error ? feeError.message : "unknown error"}`,
							);
						}
					} catch (gasError) {
						console.log(
							`   ⚠️ Could not estimate gas: ${gasError instanceof Error ? gasError.message : "unknown error"}`,
						);
					}
				} catch (error) {
					// Simulation failed
					let errorMessage = "Unknown error";
					if (error && typeof error === "object" && "shortMessage" in error) {
						errorMessage = String(error.shortMessage);
					} else if (error instanceof Error) {
						errorMessage = error.message;
					}
					console.log(
						`❌ Simulation FAILED for requisition ${index + 1}: ${errorMessage}`,
					);
					result.error = errorMessage;
				}

				return result;
			}),
		);

		// Filter out successful simulations
		const executables = simulationResults.filter((result) => result.success);
		console.log(
			`\n${executables.length} out of ${activeRequisitions.length} requisitions can be executed`,
		);

		// Check if our address is whitelisted as an operator for any of the executable requisitions
		const operatorAddress = wallet.address.toLowerCase();
		const executableForUs: SimulationResult[] = [];

		for (const result of executables) {
			let canExecute = false;
			const req = result.requisition;

			if (req.decodedData) {
				const whitelistedOperators =
					req.decodedData.operatorParams.whitelistedOperators;

				// If there are no whitelisted operators, anyone can execute
				if (whitelistedOperators.length === 0) {
					console.log(
						`Requisition ${req.requisition.blueprintHash} has no operator restrictions`,
					);
					canExecute = true;
				} else {
					// Check if our address is in the whitelist
					for (const op of whitelistedOperators) {
						if (op.toLowerCase() === operatorAddress) {
							console.log(
								`Our address is whitelisted for requisition ${req.requisition.blueprintHash}`,
							);
							canExecute = true;
							break;
						}
					}
				}
			}

			if (canExecute) {
				executableForUs.push(result);
			}
		}

		// After collecting all executable requisitions, sort them by profit (highest first)
		if (executableForUs.length > 1) {
			executableForUs.sort((a, b) => {
				// If both have profit estimates, sort by profit
				if (
					a.estimatedProfitUsd !== undefined &&
					b.estimatedProfitUsd !== undefined
				) {
					return b.estimatedProfitUsd - a.estimatedProfitUsd;
				}
				// If only one has profit estimate, prioritize the one with profit info
				if (a.estimatedProfitUsd !== undefined) return -1;
				if (b.estimatedProfitUsd !== undefined) return 1;
				// Otherwise don't change order
				return 0;
			});

			console.log("Sorted requisitions by estimated profit (highest first)");
		}

		// Get the first executable requisition to maintain backwards compatibility
		const firstExecutable =
			executableForUs.length > 0 ? executableForUs[0].requisition : undefined;

		if (executableForUs.length === 0) {
			console.log(
				"No executable requisitions available for our operator address",
			);
			return { canExecute: false, executableRequisitions: [] };
		}

		console.log(
			`Found ${executableForUs.length} executable requisitions for our operator address`,
		);
		return {
			canExecute: executableForUs.length > 0,
			requisition: firstExecutable,
			executableRequisitions: executableForUs,
		};
	} catch (error) {
		console.error("Error checking if action can be executed:", error);
		return { canExecute: false, executableRequisitions: [] };
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

		// Always simulate the transaction to check if it will succeed
		console.log("Simulating transaction...");
		try {
			await contract.tractor.staticCall(requisition.requisition, operatorData);
			console.log(
				"Simulation successful! Transaction should execute properly.",
			);
		} catch (error) {
			// Extract and log just the short message
			const errorMessage =
				error && typeof error === "object" && "shortMessage" in error
					? error.shortMessage
					: "Unknown error";
			console.error("Transaction simulation failed:", errorMessage);
			console.log("Not sending the transaction to avoid wasting gas.");
			return;
		}

		// Check execution mode before sending the actual transaction
		if (EXECUTION_MODE.toLowerCase() === "preview") {
			console.log("Running in PREVIEW mode. Transaction not sent.");
			console.log(
				"To execute transactions, set EXECUTION_MODE=execute in your .env file.",
			);
			return;
		}

		// If simulation was successful and we're in execute mode, proceed with the actual transaction
		console.log("Running in EXECUTE mode. Submitting tractor transaction...");
		const tx = await contract.tractor(requisition.requisition, operatorData);

		console.log(`Transaction submitted: ${tx.hash}`);
		console.log("Waiting for transaction confirmation...");

		const receipt = await tx.wait();
		console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
		console.log("Action executed successfully");
	} catch (error) {
		console.error("Error executing action:", error);
	}
}

// Main monitoring function - update to handle multiple requisitions
async function monitor(): Promise<void> {
	console.log("Monitoring started...");

	try {
		const { canExecute, executableRequisitions } =
			await checkForExecutableRequisitions();

		if (canExecute && executableRequisitions.length > 0) {
			console.log(
				`${executableRequisitions.length} actions can be executed, proceeding...`,
			);

			// Execute each requisition sequentially
			for (const {
				requisition,
				gasEstimate,
				operatorTip,
				gasCostEth,
				gasCostUsd,
				operatorTipUsd,
				estimatedProfitUsd,
			} of executableRequisitions) {
				console.log(
					`\nProcessing requisition: ${requisition.requisition.blueprintHash}`,
				);
				if (gasEstimate) {
					console.log(`Estimated gas: ${gasEstimate}`);
				}
				if (gasCostEth) {
					console.log(`Estimated cost: ${gasCostEth.toFixed(6)} ETH`);
				}
				if (gasCostUsd) {
					console.log(`Estimated cost: $${gasCostUsd.toFixed(6)} USD`);
				}
				if (operatorTip) {
					console.log(`Operator tip: ${operatorTip} Pinto`);
					if (operatorTipUsd) {
						console.log(
							`Operator tip value: $${operatorTipUsd.toFixed(6)} USD`,
						);
					}
				}
				// Add profit display
				if (estimatedProfitUsd !== undefined) {
					const isProfitable = estimatedProfitUsd >= 0;
					console.log(
						`Estimated profit: $${estimatedProfitUsd.toFixed(6)} USD ${isProfitable ? "✅ PROFITABLE" : "❌ LOSS"}`,
					);
				}
				await executeAction(requisition);
			}
		} else {
			console.log("No actions can be executed at this time");
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
console.log(`Execution mode: ${EXECUTION_MODE}`);
monitor().catch((error) => {
	console.error("Fatal error in monitoring process:", error);
	process.exit(1);
});
