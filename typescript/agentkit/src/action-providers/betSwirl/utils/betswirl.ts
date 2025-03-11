import {
  type CASINO_GAME_TYPE,
  type CasinoChainId,
  FORMAT_TYPE,
  type GameEncodedInput,
  type RawBetRequirements,
  type RawCasinoToken,
  type Token,
  casinoChainById,
  chainNativeCurrencyToToken,
  fetchBetByHash,
  formatTxnUrl,
  getBetRequirementsFunctionData,
  getCasinoTokensFunctionData,
  getPlaceBetFunctionData,
  parseRawBetRequirements,
  rawTokenToToken,
  slugById,
  getGamePausedFunctionData,
  fetchBets,
} from "@betswirl/sdk-core";
import { EvmWalletProvider } from "../../../wallet-providers";
import { type Hex, parseUnits } from "viem";

/**
 * Retrieves the chain ID from the provided EvmWalletProvider.
 *
 * @param walletProvider - The EvmWalletProvider instance to get the chain ID from.
 * @returns The chain ID as a number, cast to CasinoChainId.
 * @throws Will throw an error if the chain ID is not available.
 */
function getChainId(walletProvider: EvmWalletProvider) {
  const chainId = walletProvider.getNetwork().chainId;
  if (!chainId) {
    throw new Error("No chain ID");
  }
  return Number(chainId) as CasinoChainId;
}

/**
 * Checks if a live game is paused.
 *
 * @param walletProvider - The wallet provider to interact with the blockchain.
 * @param game - The type of casino game to check.
 * @returns A promise that resolves to a boolean indicating whether the game is paused.
 */
export async function checkLiveGame(walletProvider: EvmWalletProvider, game: CASINO_GAME_TYPE) {
  const gamePausedFunctionData = getGamePausedFunctionData(game, getChainId(walletProvider));
  const paused = await walletProvider.readContract({
    address: gamePausedFunctionData.data.to,
    abi: gamePausedFunctionData.data.abi,
    functionName: gamePausedFunctionData.data.functionName,
  });
  return paused;
}

/**
 * Retrieves the bet token based on the provided wallet provider and optional token symbol.
 *
 * @param walletProvider - The wallet provider instance for the EVM chain.
 * @param tokenSymbolInput - (Optional) The symbol of the token to be retrieved. If not provided or if it matches the native currency symbol, the native currency token will be returned.
 * @returns A promise that resolves to the selected token.
 * @throws Will throw an error if the provided token symbol is not found among the casino tokens.
 */
export async function getBetToken(walletProvider: EvmWalletProvider, tokenSymbolInput?: string) {
  const chainId = getChainId(walletProvider);
  const casinoChain = casinoChainById[chainId];
  let selectedToken: Token | undefined;
  if (tokenSymbolInput && tokenSymbolInput !== casinoChain.viemChain.nativeCurrency.symbol) {
    const casinoTokens = await getCasinoTokens(walletProvider);
    // Validate the token
    selectedToken = casinoTokens.find(casinoToken => casinoToken.symbol === tokenSymbolInput);
    if (!selectedToken) {
      throw new Error(
        `The token must be one of ${casinoTokens.map(casinoToken => casinoToken.symbol).join(", ")}`,
      );
    }
  } else {
    selectedToken = chainNativeCurrencyToToken(casinoChain.viemChain.nativeCurrency);
  }
  return selectedToken;
}

/**
 * Converts a bet amount from a string to its equivalent value in Wei.
 *
 * @param betAmount - The bet amount as a string.
 * @param token - The token object containing the decimals property.
 * @returns The bet amount in Wei as a BigInt.
 * @throws Will throw an error if the bet amount is less than or equal to 0.
 */
export function getBetAmountInWei(betAmount: string, token: Token) {
  const betAmountInWei = parseUnits(betAmount, token.decimals);
  if (betAmountInWei <= 0n) {
    throw new Error("The bet amount must be greater than 0");
  }
  return betAmountInWei;
}

/**
 * Retrieves the bet requirements for a given game and bet token.
 *
 * @param walletProvider - The wallet provider to interact with the blockchain.
 * @param game - The type of casino game.
 * @param betToken - The token used for the bet.
 * @param multiplier - The multiplier for the bet.
 * @returns A promise that resolves to the parsed bet requirements.
 * @throws An error if there is an issue retrieving the bet requirements.
 */
async function getBetRequirements(
  walletProvider: EvmWalletProvider,
  game: CASINO_GAME_TYPE,
  betToken: Token,
  multiplier: number,
) {
  const chainId = getChainId(walletProvider);
  try {
    const betRequirementsFunctionData = getBetRequirementsFunctionData(
      betToken.address,
      multiplier,
      chainId,
    );
    const rawBetRequirements = (await walletProvider.readContract({
      address: betRequirementsFunctionData.data.to,
      functionName: betRequirementsFunctionData.data.functionName,
      abi: betRequirementsFunctionData.data.abi,
      args: betRequirementsFunctionData.data.args,
    })) as RawBetRequirements;

    return parseRawBetRequirements(rawBetRequirements, betToken, multiplier, game, chainId);
  } catch (error) {
    throw new Error(`An error occured while getting the bet requirements: ${error}`);
  }
}

/**
 * Fetches the Chainlink VRF (Verifiable Random Function) cost for a given game and bet parameters.
 *
 * @param walletProvider - The EVM wallet provider instance.
 * @param game - The type of casino game.
 * @param betToken - The hexadecimal representation of the bet token address.
 * @param betCount - The number of bets.
 * @returns The Chainlink VRF cost as a bigint.
 * @throws Will throw an error if the API request fails or if there is an issue fetching the VRF cost.
 */
async function getChainlinkVrfCost(
  walletProvider: EvmWalletProvider,
  game: CASINO_GAME_TYPE,
  betToken: Hex,
  betCount: number,
  // gasPrice?: bigint,
) {
  const chainId = getChainId(walletProvider);
  try {
    /* WORKAROUND: We don't have a way to read the chainlink vrf cost because we cannot pass gasPrice in walletProvider.read, so we fetch it from the api.
            The issue is the gasPrice used to estimate the VRF fees on API side can be different from the one used while calling walletProvider.sendTransaction. It means the placeBet call function may fail...
            To avoid that, we ideally need gasPrice both in the read and in the sendTransaction call, but at least gasPrice in the sendTransaction call.
        */
    // const chainlinkVRFCostFunctionData = getChainlinkVrfCostFunctionData(
    //     game,
    //     betToken,
    //     betCount,
    //     chainId
    // );
    // const { value: chainlinkVRFCost } = (await walletProvider.read({
    //     address: chainlinkVRFCostFunctionData.data.to,
    //     functionName: chainlinkVRFCostFunctionData.data.functionName,
    //     abi: chainlinkVRFCostFunctionData.data.abi,
    //     args: chainlinkVRFCostFunctionData.data
    //         .args as unknown as unknown[],
    // })) as { value: bigint };
    // return chainlinkVRFCost;

    const params = new URLSearchParams({
      game: game.toString(),
      tokenAddress: betToken,
      betCount: betCount.toString(),
      chainId: chainId.toString(),
    });
    const response = await fetch(`https://api.betswirl.com/api/vrfFees?${params}`, {});

    if (!response.ok) {
      throw new Error(
        `An error occured while fetching the chainlink vrf cost from API: ${response.statusText}`,
      );
    }
    return BigInt(await response.json());
  } catch (error) {
    throw new Error(`An error occured while getting the chainlink vrf cost: ${error}`);
  }
}

/**
 * Places a bet on a specified casino game using the provided wallet provider and game parameters.
 *
 * @param walletProvider - The wallet provider to use for the transaction.
 * @param game - The type of casino game to place a bet on.
 * @param gameEncodedInput - The encoded input data for the game.
 * @param gameMultiplier - The multiplier for the game.
 * @param casinoGameParams - The parameters for the casino game bet.
 * @param casinoGameParams.betAmount - The amount to bet.
 * @param casinoGameParams.betToken - The token to use for the bet.
 * @param casinoGameParams.betCount - The number of bets to place.
 * @param casinoGameParams.receiver - The receiver address for the bet.
 * @param casinoGameParams.stopGain - The stop gain limit for the bet.
 * @param casinoGameParams.stopLoss - The stop loss limit for the bet.
 * @returns A promise that resolves to the transaction hash of the placed bet.
 * @throws Will throw an error if the token is not allowed for betting, if the bet amount exceeds the maximum allowed, or if the bet count exceeds the maximum allowed.
 * @throws Will throw an error if an issue occurs while placing the bet.
 */
export async function placeBet(
  walletProvider: EvmWalletProvider,
  game: CASINO_GAME_TYPE,
  gameEncodedInput: GameEncodedInput,
  gameMultiplier: number,
  casinoGameParams: {
    betAmount: bigint;
    betToken: Token;
    betCount: number;
    receiver: Hex;
    stopGain: bigint;
    stopLoss: bigint;
  },
) {
  const chainId = getChainId(walletProvider);
  const betRequirements = await getBetRequirements(
    walletProvider,
    game,
    casinoGameParams.betToken,
    gameMultiplier,
  );

  if (!betRequirements.isAllowed) {
    throw new Error(`The token isn't allowed for betting`);
  }
  if (casinoGameParams.betAmount > betRequirements.maxBetAmount) {
    throw new Error(`Bet amount should be less than ${betRequirements.maxBetAmount}`);
  }
  if (casinoGameParams.betCount > betRequirements.maxBetCount) {
    throw new Error(`Bet count should be less than ${betRequirements.maxBetCount}`);
  }

  const functionData = getPlaceBetFunctionData(
    {
      betAmount: casinoGameParams.betAmount,

      game,
      gameEncodedInput: gameEncodedInput,
      receiver: casinoGameParams.receiver,
      betCount: casinoGameParams.betCount,
      tokenAddress: casinoGameParams.betToken.address,
      stopGain: casinoGameParams.stopGain,
      stopLoss: casinoGameParams.stopLoss,
    },
    chainId,
  );

  try {
    // Get can't get gas price from the provider. c.f. `getChainlinkVrfCost` comments.
    // const gasPrice =
    //     ((await walletProvider.getGasPrice()) *
    //         120n) /
    //     100n;

    const vrfCost =
      ((await getChainlinkVrfCost(
        walletProvider,
        game,
        casinoGameParams.betToken.address,
        casinoGameParams.betCount,
        // gasPrice, // that we couldn't get from provider
      )) *
        120n) /
      100n;
    const betHash = await walletProvider.sendTransaction({
      to: functionData.data.to,
      data: functionData.encodedData,
      value: functionData.extraData.getValue(vrfCost),
    });

    return betHash as Hex;
  } catch (error) {
    throw new Error(`An error occured while placing the bet: ${error}`);
  }
}

/**
 * Retrieves bet details from the blockchain using the provided transaction hash.
 *
 * @param walletProvider - The wallet provider to interact with the blockchain.
 * @param txHash - The transaction hash of the bet.
 * @param theGraphKey - Optional key for The Graph API.
 * @returns A promise that resolves to the bet details.
 * @throws Will throw an error if the bet data retrieval exceeds 1 minute or if there is an error fetching the bet.
 */
export async function getBet(
  walletProvider: EvmWalletProvider,
  txHash: Hex,
  theGraphKey?: string,
): Promise<BetDetails> {
  const chainId = getChainId(walletProvider);
  try {
    let betData = await fetchBetByHash(txHash, {
      chainId,
      theGraphKey,
      formatType: FORMAT_TYPE.PRECISE,
    });
    const startTime = Date.now(); // Record the start time
    const timeout = 60000; // 1 minute timeout
    while ((!betData.bet || !betData.bet.isResolved) && !betData.error) {
      if (Date.now() - startTime >= timeout) {
        throw new Error("Timeout: Bet data retrieval exceeded 1 minute.");
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      betData = await fetchBetByHash(txHash, { chainId, theGraphKey });
      if (betData.error) {
        break;
      }
    }
    if (betData.error) {
      throw new Error(`[${betData.error.code}] Error fetching bet: ${betData.error.message}`);
    }
    if (!betData.bet) {
      throw new Error(`The bet hasn't been indexed in time, please retry later: ${txHash}`);
    }
    const bet = betData.bet;
    return {
      id: String(bet.id),
      input: bet.decodedInput,
      betTxnHash: bet.betTxnHash,
      betTxnLink: formatTxnUrl(bet.betTxnHash, chainId),
      betAmount: bet.formattedBetAmount,
      token: bet.token.symbol,
      isWin: bet.isWin,
      payoutMultiplier: bet.formattedPayoutMultiplier,
      rolled: bet.decodedRolled,
      payout: bet.formattedPayout,
      rollTxnHash: bet.rollTxnHash,
      rollTxnLink: bet.rollTxnHash ? formatTxnUrl(bet.rollTxnHash, chainId) : null,
      linkOnBetSwirl: `https://www.betswirl.com/${slugById[chainId]}/casino/${bet.game}/${bet.id}`,
    };
  } catch (error) {
    throw new Error(`An error occured while getting the bet: ${error}`);
  }
}

/**
 * Retrieves the list of casino tokens for a given wallet provider.
 *
 * @param walletProvider - The wallet provider to use for reading the contract.
 * @returns A promise that resolves to an array of tokens.
 */
export async function getCasinoTokens(walletProvider: EvmWalletProvider): Promise<Token[]> {
  const chainId = getChainId(walletProvider);
  const casinoTokensFunctionData = getCasinoTokensFunctionData(chainId);

  const rawCasinoTokens = (await walletProvider.readContract({
    address: casinoTokensFunctionData.data.to,
    functionName: casinoTokensFunctionData.data.functionName,
    abi: casinoTokensFunctionData.data.abi,
  })) as RawCasinoToken[];

  return rawCasinoTokens
    .filter(rawToken => rawToken.token.allowed && !rawToken.token.paused)
    .map(rawToken => ({
      ...rawTokenToToken(rawToken, chainId),
      decimals: Number(rawToken.decimals),
    }));
}

/**
 * Fetches bets from the subgraph based on the provided parameters.
 *
 * @param walletProvider - The wallet provider to use for fetching the bets.
 * @param bettor - (Optional) The address of the bettor to filter the bets.
 * @param game - (Optional) The type of casino game to filter the bets.
 * @param theGraphKey - (Optional) The key to use for accessing The Graph API.
 * @returns A promise that resolves to an array of bet details.
 * @throws Will throw an error if there is an issue fetching the bets.
 */
export async function getSubgraphBets(
  walletProvider: EvmWalletProvider,
  bettor?: Hex,
  game?: CASINO_GAME_TYPE,
  theGraphKey?: string,
): Promise<BetDetails[]> {
  const chainId = getChainId(walletProvider);
  try {
    const bets = await fetchBets(
      { chainId, theGraphKey, formatType: FORMAT_TYPE.PRECISE },
      {
        bettor,
        game,
      },
      undefined,
      5,
    );
    if (bets.error) {
      throw new Error(`[${bets.error.code}] Error fetching bets: ${bets.error.message}`);
    }
    return bets.bets.map(bet => ({
      id: String(bet.id),
      input: bet.decodedInput,
      betTxnHash: bet.betTxnHash,
      betTxnLink: formatTxnUrl(bet.betTxnHash, chainId),
      betAmount: bet.formattedBetAmount,
      token: bet.token.symbol,
      isWin: bet.isWin,
      payoutMultiplier: bet.formattedPayoutMultiplier,
      rolled: bet.decodedRolled,
      payout: bet.formattedPayout,
      rollTxnHash: bet.rollTxnHash,
      rollTxnLink: bet.rollTxnHash ? formatTxnUrl(bet.rollTxnHash, chainId) : null,
      linkOnBetSwirl: `https://www.betswirl.com/${slugById[chainId]}/casino/${bet.game}/${bet.id}`,
    }));
  } catch (error) {
    throw new Error(`An error occured while getting the bet: ${error}`);
  }
}

export type BetDetails = {
  id: string;
  input: string;
  betTxnHash: string;
  betTxnLink: string;
  betAmount: string;
  token: string;
  isWin?: boolean;
  payoutMultiplier?: number;
  rolled?: Array<number | string>;
  payout?: string;
  rollTxnHash?: string | null;
  rollTxnLink: string | null;
  linkOnBetSwirl: string;
};
