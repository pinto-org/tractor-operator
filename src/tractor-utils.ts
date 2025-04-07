import { ethers } from "ethers";
import { sowBlueprintv0ABI } from "./SowBlueprintv0ABI";

// Types for working with Tractor orders
export interface Requisition {
	blueprint: {
		publisher: string;
		data: string;
		operatorPasteInstrs: readonly string[];
		maxNonce: bigint;
		startTime: bigint;
		endTime: bigint;
	};
	blueprintHash: string;
	signature: string;
}

// Add the TokenStrategy type
export type TokenStrategy =
	| { type: "LOWEST_SEEDS" }
	| { type: "LOWEST_PRICE" }
	| { type: "SPECIFIC_TOKEN"; address: string };

// Farm modes enum
export enum FarmFromMode {
	INTERNAL = 0,
	EXTERNAL = 1,
	INTERNAL_EXTERNAL = 2,
	EXTERNAL_INTERNAL = 3,
	INTERNAL_TOLERANT = 4,
	EXTERNAL_TOLERANT = 5,
}

/**
 * Utility class to handle token value conversions
 */
export class TokenValue {
	static ZERO = new TokenValue("0");

	private value: string;
	private decimals: number;

	constructor(value: string, decimals = 18) {
		this.value = value;
		this.decimals = decimals;
	}

	static fromBlockchain(value: bigint, decimals: number): TokenValue {
		// Convert from blockchain format (with decimals) to human readable
		const divisor = BigInt(10) ** BigInt(decimals);
		const wholePart = value / divisor;
		const fractionalPart = value % divisor;

		// Pad the fractional part with leading zeros
		const paddedFractionalPart = fractionalPart
			.toString()
			.padStart(decimals, "0");

		// Remove trailing zeros
		const trimmedFractionalPart = paddedFractionalPart.replace(/0+$/, "");

		// Format the final string
		const formattedValue = trimmedFractionalPart
			? `${wholePart}.${trimmedFractionalPart}`
			: wholePart.toString();

		return new TokenValue(formattedValue, decimals);
	}

	toBigInt(): bigint {
		// Convert from human readable to blockchain format
		const [wholePart, fractionalPart = ""] = this.value.split(".");
		const paddedFractionalPart = fractionalPart
			.padEnd(this.decimals, "0")
			.slice(0, this.decimals);
		const combinedValue = `${wholePart}${paddedFractionalPart}`;
		return BigInt(combinedValue);
	}

	toHuman(): string {
		return this.value;
	}

	add(other: TokenValue | string | number): TokenValue {
		const otherValue =
			typeof other === "string" || typeof other === "number"
				? new TokenValue(other.toString(), this.decimals)
				: other;

		const sum = this.toBigInt() + otherValue.toBigInt();
		return TokenValue.fromBlockchain(sum, this.decimals);
	}

	mul(factor: number): TokenValue {
		// Simple multiplication by a number
		const value = Number.parseFloat(this.value) * factor;
		return new TokenValue(value.toString(), this.decimals);
	}

	gt(other: TokenValue): boolean {
		return this.toBigInt() > other.toBigInt();
	}

	static min(a: TokenValue, b: TokenValue): TokenValue {
		return a.toBigInt() <= b.toBigInt() ? a : b;
	}
}

// Basic ABI definitions for interacting with contracts
export const beanstalkAbi = [
	{
		inputs: [
			{
				components: [
					{
						internalType: "bytes",
						name: "callData",
						type: "bytes",
					},
					{
						internalType: "bytes",
						name: "clipboard",
						type: "bytes",
					},
				],
				internalType: "struct LibFunction.Call[]",
				name: "advancedFarm",
				type: "tuple[]",
			},
		],
		name: "advancedFarm",
		outputs: [
			{
				internalType: "bytes[]",
				name: "results",
				type: "bytes[]",
			},
		],
		stateMutability: "payable",
		type: "function",
	},
	{
		inputs: [
			{
				components: [
					{
						internalType: "address",
						name: "target",
						type: "address",
					},
					{
						internalType: "bytes",
						name: "callData",
						type: "bytes",
					},
					{
						internalType: "bytes",
						name: "clipboard",
						type: "bytes",
					},
				],
				internalType: "struct LibFunction.Pipe[]",
				name: "pipes",
				type: "tuple[]",
			},
			{
				internalType: "uint256",
				name: "outputIndex",
				type: "uint256",
			},
		],
		name: "advancedPipe",
		outputs: [
			{
				internalType: "bytes",
				name: "",
				type: "bytes",
			},
		],
		stateMutability: "payable",
		type: "function",
	},
];

export const tractorHelpersABI = [
	{
		inputs: [
			{
				internalType: "address",
				name: "tokenAddress",
				type: "address",
			},
		],
		name: "getTokenIndex",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
];

export const diamondABI = [
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "bytes32",
				name: "blueprintHash",
				type: "bytes32",
			},
		],
		name: "CancelBlueprint",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				components: [
					{
						components: [
							{
								internalType: "address",
								name: "publisher",
								type: "address",
							},
							{
								internalType: "bytes",
								name: "data",
								type: "bytes",
							},
							{
								internalType: "bytes32[]",
								name: "operatorPasteInstrs",
								type: "bytes32[]",
							},
							{
								internalType: "uint256",
								name: "maxNonce",
								type: "uint256",
							},
							{
								internalType: "uint256",
								name: "startTime",
								type: "uint256",
							},
							{
								internalType: "uint256",
								name: "endTime",
								type: "uint256",
							},
						],
						internalType: "struct Blueprint",
						name: "blueprint",
						type: "tuple",
					},
					{
						internalType: "bytes32",
						name: "blueprintHash",
						type: "bytes32",
					},
					{
						internalType: "bytes",
						name: "signature",
						type: "bytes",
					},
				],
				indexed: false,
				internalType: "struct Requisition",
				name: "requisition",
				type: "tuple",
			},
		],
		name: "PublishRequisition",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "account",
				type: "address",
			},
			{
				indexed: true,
				internalType: "uint256",
				name: "fieldId",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "index",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "beans",
				type: "uint256",
			},
			{
				indexed: false,
				internalType: "uint256",
				name: "pods",
				type: "uint256",
			},
		],
		name: "Sow",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: "address",
				name: "publisher",
				type: "address",
			},
			{
				indexed: true,
				internalType: "address",
				name: "operator",
				type: "address",
			},
			{
				indexed: false,
				internalType: "bytes32",
				name: "blueprintHash",
				type: "bytes32",
			},
		],
		name: "Tractor",
		type: "event",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "id",
				type: "uint256",
			},
		],
		name: "harvestableIndex",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "uint256",
				name: "id",
				type: "uint256",
			},
		],
		name: "podIndex",
		outputs: [
			{
				internalType: "uint256",
				name: "",
				type: "uint256",
			},
		],
		stateMutability: "view",
		type: "function",
	},
];

// Constants for contract addresses
export const SILO_HELPERS_ADDRESS =
	"0xf480dE38481C94FbF60A64b023c6F80Ee13562d6";
export const SOW_BLUEPRINT_V0_ADDRESS =
	"0x7F42Cb776120fcBF69De504DAFD20f08c568AAFD";
export const SOW_BLUEPRINT_V0_SELECTOR = "0xe8bd8a76";

/**
 * Helper function to get token index from contract
 */
export async function getTokenIndex(
	provider: ethers.JsonRpcProvider,
	tokenAddress: string,
): Promise<number> {
	const contract = new ethers.Contract(
		SILO_HELPERS_ADDRESS,
		tractorHelpersABI,
		provider,
	);
	const index = await contract.getTokenIndex(tokenAddress);
	return Number(index);
}

/**
 * Creates blueprint data from Tractor inputs
 */
export async function createSowTractorData({
	totalAmountToSow,
	temperature,
	minAmountPerSeason,
	maxAmountToSowPerSeason,
	maxPodlineLength,
	maxGrownStalkPerBdv,
	runBlocksAfterSunrise,
	operatorTip,
	whitelistedOperators,
	tokenStrategy,
	provider,
}: {
	totalAmountToSow: string;
	temperature: string;
	minAmountPerSeason: string;
	maxAmountToSowPerSeason: string;
	maxPodlineLength: string;
	maxGrownStalkPerBdv: string;
	runBlocksAfterSunrise: string;
	operatorTip: string;
	whitelistedOperators: string[];
	tokenStrategy: TokenStrategy;
	provider: ethers.JsonRpcProvider;
}): Promise<{ data: string; operatorPasteInstrs: string[]; rawCall: string }> {
	// Convert inputs to appropriate types
	const totalAmount = BigInt(
		Math.floor(Number.parseFloat(totalAmountToSow) * 1e6),
	);
	const minAmount = BigInt(
		Math.floor(Number.parseFloat(minAmountPerSeason) * 1e6),
	);
	const maxAmount = BigInt(
		Math.floor(Number.parseFloat(maxAmountToSowPerSeason) * 1e6),
	);

	// Fix for maxPodlineLength
	const cleanMaxPodlineLength = maxPodlineLength.replace(/,/g, "");
	const [whole, decimal = ""] = cleanMaxPodlineLength.split(".");
	const paddedDecimal = decimal.padEnd(6, "0").slice(0, 6);
	const maxPodlineBigInt = BigInt(whole + paddedDecimal);

	const maxGrownStalk = BigInt(
		Math.floor(Number.parseFloat(maxGrownStalkPerBdv) * 1e6),
	);
	const runBlocks = BigInt(runBlocksAfterSunrise === "true" ? 0 : 300);
	const temp = BigInt(Math.floor(Number.parseFloat(temperature) * 1e6));
	const tip = BigInt(Math.floor(Number.parseFloat(operatorTip) * 1e6));

	// Get source token indices based on strategy
	let sourceTokenIndices: number[];
	if (tokenStrategy.type === "LOWEST_SEEDS") {
		console.log("Using LOWEST_SEEDS strategy");
		sourceTokenIndices = [255];
	} else if (tokenStrategy.type === "LOWEST_PRICE") {
		console.log("Using LOWEST_PRICE strategy");
		sourceTokenIndices = [254];
	} else if (tokenStrategy.type === "SPECIFIC_TOKEN") {
		console.log(
			"Using SPECIFIC_TOKEN strategy with address:",
			tokenStrategy.address,
		);
		const index = await getTokenIndex(provider, tokenStrategy.address);
		console.log("Got token index:", index);
		sourceTokenIndices = [index];
	} else {
		console.log("Unknown strategy type:", tokenStrategy);
		sourceTokenIndices = [];
	}

	// Create the SowBlueprintStruct with the correct parameter name (params)
	const sowBlueprintStruct = {
		sowParams: {
			sourceTokenIndices,
			sowAmounts: {
				totalAmountToSow: totalAmount,
				minAmountToSowPerSeason: minAmount,
				maxAmountToSowPerSeason: maxAmount,
			},
			minTemp: temp,
			maxPodlineLength: maxPodlineBigInt,
			maxGrownStalkPerBdv: maxGrownStalk,
			runBlocksAfterSunrise: runBlocks,
			slippageRatio: BigInt(1e18),
		},
		opParams: {
			whitelistedOperators,
			tipAddress: "0x0000000000000000000000000000000000000000",
			operatorTipAmount: tip,
		},
	};

	// We need to encode the function calls as ethers would
	const sowBlueprintContract = new ethers.Contract(
		SOW_BLUEPRINT_V0_ADDRESS,
		sowBlueprintv0ABI,
	);
	// Change sowBlueprint to params as per the ABI
	const sowBlueprintCall = sowBlueprintContract.interface.encodeFunctionData(
		"sowBlueprintv0",
		[sowBlueprintStruct],
	);

	// Step 1: Wrap the sowBlueprintv0 call in an advancedPipe call
	const beanstalkContract = new ethers.Contract("0x", beanstalkAbi);
	const pipeCall = beanstalkContract.interface.encodeFunctionData(
		"advancedPipe",
		[
			[
				{
					target: SOW_BLUEPRINT_V0_ADDRESS,
					callData: sowBlueprintCall,
					clipboard: "0x0000",
				},
			],
			0n, // outputIndex parameter as BigInt
		],
	);

	// Step 2: Wrap the advancedPipe call in an advancedFarm call
	const data = beanstalkContract.interface.encodeFunctionData("advancedFarm", [
		[
			{
				callData: pipeCall,
				clipboard: "0x",
			},
		],
	]);

	return {
		data,
		operatorPasteInstrs: [],
		rawCall: sowBlueprintCall,
	};
}

/**
 * Signs a requisition using a signer's wallet
 */
export async function signRequisition(
	requisition: Requisition,
	wallet: ethers.Wallet,
): Promise<string> {
	const signature = await wallet.signMessage(
		ethers.getBytes(requisition.blueprintHash),
	);
	requisition.signature = signature;
	return signature;
}

/**
 * Update the interface to include both raw and formatted values
 */
export interface SowBlueprintData {
	sourceTokenIndices: readonly number[];
	sowAmounts: {
		totalAmountToSow: bigint;
		totalAmountToSowAsString: string;
		minAmountToSowPerSeason: bigint;
		minAmountToSowPerSeasonAsString: string;
		maxAmountToSowPerSeason: bigint;
		maxAmountToSowPerSeasonAsString: string;
	};
	minTemp: bigint;
	minTempAsString: string;
	maxPodlineLength: bigint;
	maxPodlineLengthAsString: string;
	maxGrownStalkPerBdv: bigint;
	maxGrownStalkPerBdvAsString: string;
	runBlocksAfterSunrise: bigint;
	runBlocksAfterSunriseAsString: string;
	slippageRatio: bigint;
	slippageRatioAsString: string;
	operatorParams: {
		whitelistedOperators: readonly string[];
		tipAddress: string;
		operatorTipAmount: bigint;
		operatorTipAmountAsString: string;
	};
	fromMode: FarmFromMode;
}

/**
 * Helper function to safely stringify objects with BigInt values
 */
function safeStringify(obj: unknown): string {
	return JSON.stringify(
		obj,
		(_, value) =>
			typeof value === "bigint"
				? `${value}n` // Use template literal instead of concatenation
				: value,
		2,
	);
}

/**
 * Decodes sow data from encoded function call
 * Simplified version that just extracts basic info from the call
 */
export function decodeSowTractorData(
	encodedData: string,
): SowBlueprintData | null {
	try {
		console.log("-------------------- DECODING SOW DATA --------------------");
		console.log(`Encoded data: ${encodedData.substring(0, 50)}...`);

		const beanstalkContract = new ethers.Contract("0x", beanstalkAbi);
		const sowBlueprintContract = new ethers.Contract(
			SOW_BLUEPRINT_V0_ADDRESS,
			sowBlueprintv0ABI,
		);

		// Try to decode as advancedFarm call first
		try {
			console.log("Attempting to decode as advancedFarm");
			const advancedFarmDecoded = beanstalkContract.interface.parseTransaction({
				data: encodedData,
			});

			console.log("AdvancedFarm decoded:", !!advancedFarmDecoded);
			if (advancedFarmDecoded) {
				console.log("Function name:", advancedFarmDecoded.name);
				console.log("Has args:", !!advancedFarmDecoded.args);
				console.log("Args[0] exists:", !!advancedFarmDecoded.args?.[0]);
			}

			if (
				advancedFarmDecoded &&
				advancedFarmDecoded.name === "advancedFarm" &&
				advancedFarmDecoded.args?.[0]
			) {
				const farmCalls = advancedFarmDecoded.args[0];
				console.log("Farm calls length:", farmCalls.length);

				if (farmCalls.length > 0) {
					console.log(
						"First farm call callData exists:",
						!!farmCalls[0].callData,
					);

					// Try to decode the inner call as advancedPipe
					try {
						console.log("Attempting to decode inner call as advancedPipe");
						const pipeCallData = farmCalls[0].callData;
						const advancedPipeDecoded =
							beanstalkContract.interface.parseTransaction({
								data: pipeCallData,
							});

						console.log("AdvancedPipe decoded:", !!advancedPipeDecoded);
						if (advancedPipeDecoded) {
							console.log("Pipe function name:", advancedPipeDecoded.name);
							console.log("Pipe has args:", !!advancedPipeDecoded.args);
							console.log(
								"Pipe args[0] exists:",
								!!advancedPipeDecoded.args?.[0],
							);
						}

						if (
							advancedPipeDecoded &&
							advancedPipeDecoded.name === "advancedPipe" &&
							advancedPipeDecoded.args?.[0]
						) {
							const pipeCalls = advancedPipeDecoded.args[0];
							console.log("Pipe calls length:", pipeCalls.length);

							if (pipeCalls.length > 0) {
								console.log("First pipe call target:", pipeCalls[0].target);
								console.log(
									"First pipe call callData exists:",
									!!pipeCalls[0].callData,
								);
								console.log(
									"Target equals SowBlueprint address:",
									pipeCalls[0].target.toLowerCase() ===
										SOW_BLUEPRINT_V0_ADDRESS.toLowerCase(),
								);

								// Get the sowBlueprintv0 call data
								const sowBlueprintData = pipeCalls[0].callData;

								// Try to decode the sowBlueprintv0 data directly
								try {
									console.log("Attempting to decode as sowBlueprintv0");
									console.log(
										"Target contract address:",
										SOW_BLUEPRINT_V0_ADDRESS,
									);
									console.log(
										"ABI function names:",
										sowBlueprintContract.interface.fragments
											.filter((f) => f.type === "function")
											.map((f) => (f as ethers.FunctionFragment).name)
											.join(", "),
									);
									const sowDecoded =
										sowBlueprintContract.interface.parseTransaction({
											data: sowBlueprintData,
										});

									console.log("SowBlueprint decoded:", !!sowDecoded);
									if (sowDecoded) {
										console.log("Sow function name:", sowDecoded.name);
										console.log("Has args:", !!sowDecoded.args);
										console.log("Args[0] exists:", !!sowDecoded.args?.[0]);

										if (sowDecoded.args?.[0]) {
											console.log("Sow args type:", typeof sowDecoded.args[0]);
											// Note the difference: params instead of sowBlueprint
											console.log(
												"Sow args[0] has sowParams:",
												!!sowDecoded.args[0].sowParams,
											);
											console.log(
												"Sow args[0] has opParams:",
												!!sowDecoded.args[0].opParams,
											);

											// Dump the entire args object to see its structure
											console.log(
												"Full args structure:",
												safeStringify(sowDecoded.args[0]),
											);
										}
									}

									if (sowDecoded?.args?.[0]) {
										// Note: In the new ABI, it's "params" instead of "sowBlueprint"
										const params = sowDecoded.args[0];
										console.log("Successfully decoded sow blueprint data!");

										const result = {
											sourceTokenIndices: params.sowParams.sourceTokenIndices,
											sowAmounts: {
												totalAmountToSow:
													params.sowParams.sowAmounts.totalAmountToSow,
												totalAmountToSowAsString: TokenValue.fromBlockchain(
													params.sowParams.sowAmounts.totalAmountToSow,
													6,
												).toHuman(),
												minAmountToSowPerSeason:
													params.sowParams.sowAmounts.minAmountToSowPerSeason,
												minAmountToSowPerSeasonAsString:
													TokenValue.fromBlockchain(
														params.sowParams.sowAmounts.minAmountToSowPerSeason,
														6,
													).toHuman(),
												maxAmountToSowPerSeason:
													params.sowParams.sowAmounts.maxAmountToSowPerSeason,
												maxAmountToSowPerSeasonAsString:
													TokenValue.fromBlockchain(
														params.sowParams.sowAmounts.maxAmountToSowPerSeason,
														6,
													).toHuman(),
											},
											minTemp: params.sowParams.minTemp,
											minTempAsString: TokenValue.fromBlockchain(
												params.sowParams.minTemp,
												6,
											).toHuman(),
											maxPodlineLength: params.sowParams.maxPodlineLength,
											maxPodlineLengthAsString: TokenValue.fromBlockchain(
												params.sowParams.maxPodlineLength,
												6,
											).toHuman(),
											maxGrownStalkPerBdv: params.sowParams.maxGrownStalkPerBdv,
											maxGrownStalkPerBdvAsString: TokenValue.fromBlockchain(
												params.sowParams.maxGrownStalkPerBdv,
												6,
											).toHuman(),
											runBlocksAfterSunrise:
												params.sowParams.runBlocksAfterSunrise,
											runBlocksAfterSunriseAsString:
												params.sowParams.runBlocksAfterSunrise.toString(),
											slippageRatio: params.sowParams.slippageRatio,
											slippageRatioAsString: TokenValue.fromBlockchain(
												params.sowParams.slippageRatio,
												18,
											).toHuman(),
											operatorParams: {
												whitelistedOperators:
													params.opParams.whitelistedOperators,
												tipAddress: params.opParams.tipAddress,
												operatorTipAmount: params.opParams.operatorTipAmount,
												operatorTipAmountAsString: TokenValue.fromBlockchain(
													params.opParams.operatorTipAmount,
													6,
												).toHuman(),
											},
											fromMode: FarmFromMode.INTERNAL,
										};

										console.log(
											"-------------------- DECODING COMPLETE --------------------",
										);
										return result;
									}
								} catch (error) {
									console.error("Failed to decode sowBlueprintv0 data:", error);
								}
							}
						}
					} catch (error) {
						console.log("Failed to decode as advancedPipe:", error);
					}
				}
			}
		} catch (error) {
			console.log("Failed to decode as advancedFarm:", error);
		}

		console.log("All decoding attempts failed");
		console.log("-------------------- DECODING FAILED --------------------");
		return null;
	} catch (error) {
		console.error("Failed to decode sow data:", error);
		console.log(
			"-------------------- DECODING FAILED WITH ERROR --------------------",
		);
		return null;
	}
}

/**
 * Finds the offset of the operator placeholder address in the encoded data
 * Returns -1 if the placeholder is not found
 */
export function findOperatorPlaceholderOffset(encodedData: string): number {
	// Remove 0x prefix for easier searching
	const data = encodedData.slice(2);

	// The placeholder address without 0x prefix, padded to 32 bytes (64 hex chars)
	const PLACEHOLDER =
		"0000000000000000000000004242424242424242424242424242424242424242";

	// Search for the placeholder in the data
	const index = data.toLowerCase().indexOf(PLACEHOLDER.toLowerCase());

	// Return -1 instead of throwing an error if placeholder not found
	return index === -1 ? -1 : index / 2; // Convert from hex characters to bytes
}

/**
 * Fetches tractor events from the blockchain
 */
export async function fetchTractorEvents(
	provider: ethers.JsonRpcProvider,
	protocolAddress: string,
) {
	const contract = new ethers.Contract(protocolAddress, diamondABI, provider);

	// Get published requisitions
	const publishFilter = contract.filters.PublishRequisition();
	const publishEvents = await contract.queryFilter(publishFilter, 0, "latest");

	// Get cancelled blueprints
	const cancelFilter = contract.filters.CancelBlueprint();
	const cancelEvents = await contract.queryFilter(cancelFilter, 0, "latest");

	console.log("Found published events:", publishEvents.length);
	console.log("Found cancelled events:", cancelEvents.length);

	// Create a set of cancelled blueprint hashes
	const cancelledHashes = new Set(
		cancelEvents
			.map((event) => {
				// In ethers v6, for indexed parameters they appear in the topics array
				// CancelBlueprint has one indexed parameter (blueprintHash) which is in topics[1]
				return event.topics[1] as string;
			})
			.filter((hash) => hash !== undefined),
	);

	return { publishEvents, cancelledHashes };
}

export interface RequisitionData {
	blueprint: {
		publisher: string;
		data: string;
		operatorPasteInstrs: readonly string[];
		maxNonce: bigint;
		startTime: bigint;
		endTime: bigint;
	};
	blueprintHash: string;
	signature: string;
}

export interface RequisitionEvent {
	requisition: RequisitionData;
	blockNumber: number;
	timestamp?: number;
	isCancelled?: boolean;
	requisitionType: "sowBlueprintv0" | "unknown";
	decodedData: SowBlueprintData | null;
}

export type RequisitionType = "sowBlueprintv0" | "unknown";

// Add the interface for ParsedRequisitionData right before the loadPublishedRequisitions function
export interface ParsedRequisitionData {
	blueprint: {
		publisher: string;
		data: string;
		operatorPasteInstrs: readonly string[];
		maxNonce: bigint;
		startTime: bigint;
		endTime: bigint;
	};
	blueprintHash: string;
	signature: string;
	[key: string]: unknown;
}

/**
 * Loads published requisitions from the blockchain
 */
export async function loadPublishedRequisitions(
	address: string | undefined,
	protocolAddress: string | undefined,
	provider: ethers.JsonRpcProvider | null,
	latestBlock?: { number: bigint; timestamp: bigint } | null,
	requisitionType?: RequisitionType | RequisitionType[],
): Promise<RequisitionEvent[]> {
	if (!protocolAddress || !provider) return [];

	try {
		const { publishEvents, cancelledHashes } = await fetchTractorEvents(
			provider,
			protocolAddress,
		);

		console.log("Processing events:", publishEvents.length);

		const contract = new ethers.Contract(protocolAddress, diamondABI, provider);

		const filteredEvents = publishEvents
			.map((event) => {
				// In ethers v6, we need to check if it's an EventLog and has args properly populated
				// Otherwise, we need to parse it manually
				let requisitionData: ParsedRequisitionData | undefined;

				console.log("---------------- EVENT DETAILED LOG ----------------");
				console.log("Event type:", typeof event);
				console.log("Event keys:", Object.keys(event));

				// Check if it's an EventLog with args already populated
				if ("args" in event && event.args) {
					console.log("Event has args property");
					console.log("Args type:", typeof event.args);
					console.log("Args keys:", Object.keys(event.args));
					console.log("Args[0] exists:", !!event.args[0]);

					if (event.args[0]) {
						console.log("Args[0] type:", typeof event.args[0]);
						console.log("Args[0] keys:", Object.keys(event.args[0]));
						console.log(
							"Args[0].requisition exists:",
							!!event.args[0].requisition,
						);
						console.log("Args[0].blueprint exists:", !!event.args[0].blueprint);
						console.log(
							"Args[0].blueprintHash exists:",
							!!event.args[0].blueprintHash,
						);
						console.log("Args[0].signature exists:", !!event.args[0].signature);
					}

					requisitionData = event.args[0];
				} else {
					// Try to parse the event manually
					try {
						console.log("Trying to parse event manually");
						const parsedLog = contract.interface.parseLog({
							topics: event.topics as string[],
							data: event.data,
						});

						console.log("ParsedLog success:", !!parsedLog);

						if (parsedLog) {
							console.log("ParsedLog name:", parsedLog.name);
							console.log("ParsedLog args exists:", !!parsedLog.args);

							if (parsedLog.args) {
								console.log("ParsedLog args type:", typeof parsedLog.args);
								console.log(
									"ParsedLog args keys:",
									Object.keys(parsedLog.args),
								);
								console.log("ParsedLog args[0] exists:", !!parsedLog.args[0]);

								if (parsedLog.args[0]) {
									console.log(
										"ParsedLog args[0] type:",
										typeof parsedLog.args[0],
									);
									console.log(
										"ParsedLog args[0] keys:",
										Object.keys(parsedLog.args[0]),
									);
								}
							}
						}

						if (parsedLog?.args) {
							console.log("Successfully parsed event log");
							requisitionData = parsedLog.args[0];
						}
					} catch (error) {
						console.log("Failed to parse event log:", error);
					}
				}

				if (!requisitionData) {
					console.log("No requisition data found in event");
					console.log("---------------- END EVENT LOG ----------------");
					return null;
				}

				console.log("RequisitionData type:", typeof requisitionData);
				console.log("RequisitionData keys:", Object.keys(requisitionData));

				// Convert the requisition data to our expected format
				try {
					console.log("Trying to convert requisition data");
					console.log("Blueprint exists:", !!requisitionData.blueprint);

					if (requisitionData.blueprint) {
						console.log(
							"Blueprint keys:",
							Object.keys(requisitionData.blueprint),
						);
						console.log("Publisher:", requisitionData.blueprint.publisher);
						console.log("Data exists:", !!requisitionData.blueprint.data);
						console.log(
							"OperatorPasteInstrs exists:",
							!!requisitionData.blueprint.operatorPasteInstrs,
						);
						console.log(
							"MaxNonce exists:",
							!!requisitionData.blueprint.maxNonce,
						);
						console.log(
							"StartTime exists:",
							!!requisitionData.blueprint.startTime,
						);
						console.log("EndTime exists:", !!requisitionData.blueprint.endTime);
					}

					console.log("BlueprintHash exists:", !!requisitionData.blueprintHash);
					console.log("Signature exists:", !!requisitionData.signature);

					const requisition: RequisitionData = {
						blueprint: {
							publisher: requisitionData.blueprint.publisher,
							data: requisitionData.blueprint.data,
							operatorPasteInstrs:
								requisitionData.blueprint.operatorPasteInstrs,
							maxNonce: requisitionData.blueprint.maxNonce,
							startTime: requisitionData.blueprint.startTime,
							endTime: requisitionData.blueprint.endTime,
						},
						blueprintHash: requisitionData.blueprintHash,
						signature: requisitionData.signature,
					};

					console.log("Successfully converted to RequisitionData");

					if (
						!requisition?.blueprint ||
						!requisition?.blueprintHash ||
						!requisition?.signature
					) {
						console.log("Invalid requisition:", requisition);
						console.log("---------------- END EVENT LOG ----------------");
						return null;
					}

					// Only filter by address if one is provided
					if (
						address &&
						requisition.blueprint.publisher.toLowerCase() !==
							address.toLowerCase()
					) {
						console.log("Publisher doesn't match filter address");
						console.log("---------------- END EVENT LOG ----------------");
						return null;
					}

					let eventRequisitionType: RequisitionType = "unknown";
					// Try to decode the data
					console.log("Trying to decode blueprint data");
					const decodedData = decodeSowTractorData(requisition.blueprint.data);
					console.log("Decoded data success:", !!decodedData);

					if (decodedData) {
						eventRequisitionType = "sowBlueprintv0";
						console.log("Requisition type:", eventRequisitionType);
					}

					// Filter by requisition type if provided
					if (requisitionType) {
						const typeArray = Array.isArray(requisitionType)
							? requisitionType
							: [requisitionType];
						if (!typeArray.includes(eventRequisitionType)) {
							console.log("Requisition type doesn't match filter");
							console.log("---------------- END EVENT LOG ----------------");
							return null;
						}
					}

					// Check if cancelled
					const isCancelled = cancelledHashes.has(requisition.blueprintHash);
					console.log("Is cancelled:", isCancelled);

					// Calculate timestamp if we have the latest block info
					let timestamp: number | undefined = undefined;
					if (latestBlock) {
						// Convert all BigInt values to Number before arithmetic operations
						const latestTimestamp = Number(latestBlock.timestamp);
						const latestBlockNumber = Number(latestBlock.number);
						const eventBlockNumber = Number(event.blockNumber);

						// Calculate timestamp (approximately 2 seconds per block)
						timestamp =
							latestTimestamp * 1000 -
							(latestBlockNumber - eventBlockNumber) * 2000;

						const now = Date.now();
						const startTime = Number(requisition.blueprint.startTime) * 1000;
						const endTime = Number(requisition.blueprint.endTime) * 1000;

						console.log("Current time:", new Date(now).toLocaleString());
						console.log("Start time:", new Date(startTime).toLocaleString());
						console.log("End time:", new Date(endTime).toLocaleString());
						console.log("Is active:", startTime <= now && endTime >= now);
					}

					console.log("Successfully processed requisition");
					console.log("---------------- END EVENT LOG ----------------");

					return {
						requisition,
						blockNumber: Number(event.blockNumber),
						timestamp,
						isCancelled,
						requisitionType: eventRequisitionType,
						decodedData,
					} as RequisitionEvent;
				} catch (error) {
					console.log("Error converting requisition data:", error);
					console.log("---------------- END EVENT LOG ----------------");
					return null;
				}
			})
			.filter((event): event is NonNullable<typeof event> => event !== null);

		console.log("Filtered events count:", filteredEvents.length);
		if (filteredEvents.length > 0) {
			// Print summary of each requisition
			filteredEvents.forEach((event, index) => {
				console.log(`Requisition ${index + 1}:`);
				console.log(`  Publisher: ${event.requisition.blueprint.publisher}`);
				console.log(`  Blueprint Hash: ${event.requisition.blueprintHash}`);
				console.log(`  Is Cancelled: ${event.isCancelled}`);
				console.log(`  Type: ${event.requisitionType}`);
				console.log(
					`  Start Time: ${new Date(Number(event.requisition.blueprint.startTime) * 1000).toLocaleString()}`,
				);
				console.log(
					`  End Time: ${new Date(Number(event.requisition.blueprint.endTime) * 1000).toLocaleString()}`,
				);
			});
		}

		return filteredEvents;
	} catch (error) {
		console.error("Error loading published requisitions:", error);
		throw new Error("Failed to load published requisitions");
	}
}

/**
 * Fetches tractor executions from the blockchain
 */
export async function fetchTractorExecutions(
	provider: ethers.JsonRpcProvider,
	protocolAddress: string,
	publisher: string,
) {
	const contract = new ethers.Contract(protocolAddress, diamondABI, provider);

	// Create filter for Tractor events with a specific publisher
	const tractorFilter = contract.filters.Tractor(publisher);
	console.log("Looking for Tractor events with publisher:", publisher);
	const tractorEvents = await contract.queryFilter(tractorFilter, 0, "latest");
	console.log(`Found ${tractorEvents.length} Tractor events for publisher`);

	// Process transaction receipts and collect block numbers
	const blockNumbers = new Set<bigint>();

	const processingPromises = tractorEvents.map(async (event) => {
		console.log(`Processing event with hash: ${event.transactionHash}`);
		const receipt = await provider.getTransactionReceipt(event.transactionHash);

		// Check if receipt is null
		if (!receipt) {
			console.log(`No receipt found for transaction ${event.transactionHash}`);
			return {
				blockNumber: 0,
				event,
				receipt: null,
				sowData: undefined,
			};
		}

		// Add block number to the set for batch fetching
		blockNumbers.add(BigInt(receipt.blockNumber));

		// Find the Sow event in the transaction logs
		let sowData: Record<string, unknown> | undefined = undefined;
		console.log(`Scanning ${receipt.logs.length} logs for Sow events`);

		for (const log of receipt.logs) {
			try {
				// Try to parse the log as a Sow event
				const parsed = contract.interface.parseLog({
					topics: log.topics as string[],
					data: log.data,
				});

				if (parsed && parsed.name === "Sow") {
					console.log("Found Sow event in transaction");
					sowData = {
						account: parsed.args.account,
						fieldId: parsed.args.fieldId,
						index: parsed.args.index,
						beans: parsed.args.beans,
						pods: parsed.args.pods,
					};
					break;
				}
			} catch {
				// Ignore errors from trying to parse logs
			}
		}

		if (!sowData) {
			console.log("No Sow event found in transaction");
		}

		return {
			blockNumber: receipt.blockNumber,
			event,
			receipt,
			sowData,
		};
	});

	const processingResults = await Promise.all(processingPromises);
	console.log(`Processed ${processingResults.length} execution results`);

	// Fetch all required blocks in a batch
	const blockPromises = Array.from(blockNumbers).map((blockNumber) =>
		provider.getBlock(blockNumber),
	);
	const blocks = await Promise.all(blockPromises);
	console.log(`Retrieved ${blocks.length} blocks for timestamp information`);

	// Build a map of block numbers to timestamps
	const blockTimestamps = new Map<string, number>();
	for (const block of blocks) {
		if (block) {
			blockTimestamps.set(
				block.number.toString(),
				Number(block.timestamp) * 1000,
			);
		}
	}

	// Assemble the final result
	return processingResults.map((result) => {
		// Skip results with null receipt
		if (!result.receipt) {
			return {
				blockNumber: 0,
				operator: undefined,
				publisher: undefined,
				blueprintHash: undefined,
				transactionHash: result.event.transactionHash,
				timestamp: undefined,
				sowEvent: undefined,
			};
		}

		// For ethers v6, parse the event to get args
		let operator: string | undefined;
		let eventPublisher: string | undefined;
		let blueprintHash: string | undefined;

		try {
			const parsedLog = contract.interface.parseLog({
				topics: result.event.topics as string[],
				data: result.event.data,
			});

			if (parsedLog?.args) {
				operator = parsedLog?.args.operator;
				eventPublisher = parsedLog?.args.publisher;
				blueprintHash = parsedLog?.args.blueprintHash;
				console.log(
					`Parsed log for transaction ${result.event.transactionHash}`,
				);
				console.log(`Operator: ${operator}, Publisher: ${eventPublisher}`);
			}
		} catch (error) {
			console.log(`Error parsing log: ${error}`);
		}

		return {
			blockNumber: Number(result.blockNumber),
			operator,
			publisher: eventPublisher,
			blueprintHash,
			transactionHash: result.event.transactionHash,
			timestamp: blockTimestamps.get(result.blockNumber.toString()),
			sowEvent: result.sowData,
		};
	});
}
