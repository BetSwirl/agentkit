/**
 * BetSwirl Action Provider
 *
 * This file contains the implementation of the BetSwirlActionProvider,
 * which provides actions for betSwirl operations.
 *
 * @module betswirl
 */

import { z } from "zod";
import { type Hex } from "viem";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";

import { CoinTossSchema, DiceSchema, RouletteSchema, GetBetSchema, GetBetsSchema } from "./schemas";

import {
  CASINO_GAME_TYPE,
  COINTOSS_FACE,
  CoinToss,
  Dice,
  DiceNumber,
  Roulette,
  RouletteNumber,
  casinoChains,
} from "@betswirl/sdk-core";

import {
  checkLiveGame,
  getBet,
  getBetAmountInWei,
  getBetToken,
  placeBet,
  BetDetails,
  getSubgraphBets,
} from "./utils/betswirl";

/**
 * BetSwirlActionProvider is an action provider for the BetSwirl platform.
 * It extends the ActionProvider class with specific functionality for handling
 * coin toss bets on the BetSwirl platform.
 *
 * @augments ActionProvider<EvmWalletProvider>
 */
export class BetSwirlActionProvider extends ActionProvider<EvmWalletProvider> {
  private theGraphKey?: string;

  /**
   * Constructs a new instance of the BetSwirlActionProvider.
   *
   * @param theGraphKey - An optional key for The Graph integration.
   */
  constructor(theGraphKey?: string) {
    super("betswirl", []);
    this.theGraphKey = theGraphKey;
  }

  /**
   * Places a coin toss bet using the provided wallet provider and bet arguments.
   *
   * @param walletProvider - The wallet provider to use for the bet.
   * @param args - The arguments for the coin toss bet, inferred from the CoinTossSchema.
   * @returns A promise that resolves to the details of the placed bet.
   *
   * @throws Will throw an error if the game is not live.
   * @throws Will throw an error if the bet token is invalid.
   * @throws Will throw an error if the bet amount is invalid.
   * @throws Will throw an error if there are issues with placing the bet.
   */
  @CreateAction({
    name: "betswirl_coinToss",
    description: `
      Coin Toss action is flipping an onchain coin.
      The player is betting that the rolled face will be the one chosen.
      
      The required input are:
      - betAmount in ether unit
      - token symbol
      - face of the coin

      The expected output is the bet details.
    `,
    schema: CoinTossSchema,
  })
  async coinToss(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CoinTossSchema>,
  ): Promise<BetDetails> {
    await checkLiveGame(walletProvider, CASINO_GAME_TYPE.COINTOSS);

    const face = args.face as COINTOSS_FACE;

    // Get the bet token from the user input
    const selectedToken = await getBetToken(walletProvider, args.token);

    // Validate the bet amount
    const betAmountInWei = getBetAmountInWei(args.betAmount, selectedToken);

    const hash = await placeBet(
      walletProvider,
      CASINO_GAME_TYPE.COINTOSS,
      CoinToss.encodeInput(face),
      CoinToss.getMultiplier(face),
      {
        betAmount: betAmountInWei,
        betToken: selectedToken,
        betCount: 1,
        receiver: walletProvider.getAddress() as Hex,
        stopGain: 0n,
        stopLoss: 0n,
      },
    );

    return await getBet(walletProvider, hash, this.theGraphKey);
  }

  /**
   * Places a dice bet using the provided wallet provider and arguments.
   *
   * @param walletProvider - The wallet provider to use for the bet.
   * @param args - The arguments for the dice bet, inferred from the DiceSchema.
   * @returns A promise that resolves to the details of the placed bet.
   *
   * @throws Will throw an error if the game is not live.
   * @throws Will throw an error if the bet token is invalid.
   * @throws Will throw an error if the bet amount is invalid.
   * @throws Will throw an error if there are issues with placing the bet.
   */
  @CreateAction({
    name: "betswirl_dice",
    description: `
      Dice action is rolling an onchain dice of 100 faces.
      The player is betting that the rolled number will be above this chosen number. 
      
      The required input are:
      - betAmount in ether unit
      - token symbol
      - number to bet on

      The expected output is the bet details.
    `,
    schema: DiceSchema,
  })
  async dice(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof DiceSchema>,
  ): Promise<BetDetails> {
    await checkLiveGame(walletProvider, CASINO_GAME_TYPE.DICE);

    const number = args.number as DiceNumber;

    // Get the bet token from the user input
    const selectedToken = await getBetToken(walletProvider, args.token);

    // Validate the bet amount
    const betAmountInWei = getBetAmountInWei(args.betAmount, selectedToken);

    const hash = await placeBet(
      walletProvider,
      CASINO_GAME_TYPE.DICE,
      Dice.encodeInput(number),
      Dice.getMultiplier(number),
      {
        betAmount: betAmountInWei,
        betToken: selectedToken,
        betCount: 1,
        receiver: walletProvider.getAddress() as Hex,
        stopGain: 0n,
        stopLoss: 0n,
      },
    );

    return await getBet(walletProvider, hash, this.theGraphKey);
  }

  /**
   * Places a roulette bet using the provided wallet provider and bet arguments.
   *
   * @param walletProvider - The wallet provider to use for the bet.
   * @param args - The arguments for the roulette bet, inferred from the RouletteSchema.
   * @returns A promise that resolves to the details of the placed bet.
   *
   * @throws Will throw an error if the game is not live.
   * @throws Will throw an error if the bet token is invalid.
   * @throws Will throw an error if the bet amount is invalid.
   * @throws Will throw an error if there are issues with placing the bet.
   */
  @CreateAction({
    name: "betswirl_roulette",
    description: `
      Roulette action is spinning an onchain roulette.
      The player is betting that the rolled number will be one of the chosen numbers. 
      
      The required input are:
      - betAmount in ether unit
      - token symbol
      - numbers to bet on

      The expected output is the bet details.
    `,
    schema: RouletteSchema,
  })
  async roulette(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RouletteSchema>,
  ): Promise<BetDetails> {
    await checkLiveGame(walletProvider, CASINO_GAME_TYPE.ROULETTE);

    const numbers = args.numbers as RouletteNumber[];

    // Get the bet token from the user input
    const selectedToken = await getBetToken(walletProvider, args.token);

    // Validate the bet amount
    const betAmountInWei = getBetAmountInWei(args.betAmount, selectedToken);

    const hash = await placeBet(
      walletProvider,
      CASINO_GAME_TYPE.ROULETTE,
      Roulette.encodeInput(numbers),
      Roulette.getMultiplier(numbers),
      {
        betAmount: betAmountInWei,
        betToken: selectedToken,
        betCount: 1,
        receiver: walletProvider.getAddress() as Hex,
        stopGain: 0n,
        stopLoss: 0n,
      },
    );

    return await getBet(walletProvider, hash, this.theGraphKey);
  }

  /**
   * Retrieves the details of a bet using the provided wallet provider and arguments.
   *
   * @param walletProvider - The wallet provider to use for the request.
   * @param args - The arguments required to fetch the bet details, inferred from GetBetSchema.
   * @returns A promise that resolves to the details of the bet.
   * @throws Will throw an error if there are issues with retrieving the bet.
   * @throws Will throw an error if the bet hasn't been indexed within a minute.
   */
  @CreateAction({
    name: "betswirl_getBet",
    description: `
      Get bet action retrieves a bet details from its hash.

      The required input are:
      - hash of the transaction

      The expected output is the bet details.
    `,
    schema: GetBetSchema,
  })
  async getBet(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetBetSchema>,
  ): Promise<BetDetails> {
    return await getBet(walletProvider, args.hash as Hex, this.theGraphKey);
  }

  /**
   * Retrieves bet details from the subgraph based on the provided arguments.
   *
   * @param walletProvider - The wallet provider to interact with the Ethereum network.
   * @param args - The arguments for retrieving bets, inferred from the GetBetsSchema.
   * @returns A promise that resolves to an array of BetDetails.
   * @throws Will throw an error if there are issues with retrieving the bet.
   */
  @CreateAction({
    name: "betswirl_getBets",
    description: `
      Get bets action retrieves bets details list.

      The required input are:
      - bettor address
      - game

      The expected output is the bet details.
    `,
    schema: GetBetsSchema,
  })
  async getBets(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetBetsSchema>,
  ): Promise<BetDetails[]> {
    return await getSubgraphBets(walletProvider, args.bettor as Hex, args.game, this.theGraphKey);
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(network: Network): boolean {
    // all protocol networks
    return (
      network.protocolFamily === "evm" &&
      casinoChains.some(casinoChain => casinoChain.id === Number(network.chainId))
    );
  }
}

/**
 * Factory function to create a new BetSwirlActionProvider instance.
 *
 * @param theGraphKey - Optional key for The Graph integration
 * @returns A new instance of BetSwirlActionProvider
 */
export const betSwirlActionProvider = (theGraphKey?: string) =>
  new BetSwirlActionProvider(theGraphKey);
