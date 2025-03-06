import { z } from "zod";
import {
  CASINO_GAME_TYPE,
  COINTOSS_FACE,
  maxGameBetCountByType,
  MAX_SELECTABLE_DICE_NUMBER,
  MIN_SELECTABLE_DICE_NUMBER,
  MAX_SELECTABLE_ROULETTE_NUMBER,
  MIN_SELECTABLE_ROULETTE_NUMBER,
} from "@betswirl/sdk-core";

export const hexAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "The address must be a valid EVM address");

export const casinoBetParams = {
  betAmount: z.string().describe("The bet amount"),
  token: z.string().describe("Token symbol").optional().describe("The token to bet with"),
  stopGain: z.string().optional().describe("The profit amount to stop betting"),
  stopLoss: z.string().optional().describe("The loss amount to stop betting"),
  receiver: hexAddress.optional().describe("The payout receiver address"),
};

/**
 * Generates a schema for the maximum bet count parameter based on the game type.
 *
 * @param game - The type of casino game for which to get the maximum bet count.
 * @returns An object containing the bet count schema.
 */
export function getMaxBetCountParam(game: CASINO_GAME_TYPE) {
  return {
    betCount: z
      .number()
      .positive()
      .max(maxGameBetCountByType[game])
      .default(1)
      .optional()
      .describe("The number of bets to place"),
  };
}

export const CoinTossSchema = z.object({
  face: z.nativeEnum(COINTOSS_FACE).describe("The face of the coin"),
  ...casinoBetParams,
  ...getMaxBetCountParam(CASINO_GAME_TYPE.COINTOSS),
});

export const DiceSchema = z.object({
  number: z
    .number()
    .gte(MIN_SELECTABLE_DICE_NUMBER)
    .lte(MAX_SELECTABLE_DICE_NUMBER)
    .describe("The number to bet on"),
  ...casinoBetParams,
  ...getMaxBetCountParam(CASINO_GAME_TYPE.DICE),
});

export const RouletteSchema = z.object({
  numbers: z
    .number()
    .gte(MIN_SELECTABLE_ROULETTE_NUMBER)
    .lte(MAX_SELECTABLE_ROULETTE_NUMBER)
    .array()
    .min(1)
    .max(MAX_SELECTABLE_ROULETTE_NUMBER)
    .describe("The numbers to bet on"),
  ...casinoBetParams,
  ...getMaxBetCountParam(CASINO_GAME_TYPE.ROULETTE),
});

export const GetBetSchema = z.object({
  hash: z
    .string()
    .regex(/0x[0-9a-fA-F]{64}/, "The hash mush be a valid EVM transaction hash")
    .describe("The bet hash"),
});

export const GetBetsSchema = z.object({
  bettor: hexAddress.optional().describe("The bettor address"),
  game: z.nativeEnum(CASINO_GAME_TYPE).optional().describe("The game to get the bets for"),
});
