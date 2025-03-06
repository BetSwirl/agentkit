import { BetSwirlActionProvider } from "./betSwirlActionProvider";
import { Network } from "../../network";
import {
  casinoBetParams,
  CoinTossSchema,
  DiceSchema,
  RouletteSchema,
  GetBetSchema,
  GetBetsSchema,
} from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import z from "zod";
import { COINTOSS_FACE } from "@betswirl/sdk-core";

describe("BetSwirlActionProvider", () => {
  const provider = new BetSwirlActionProvider();
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockWalletProvider = {
      getAddress: jest.fn(),
      getBalance: jest.fn(),
      getName: jest.fn(),
      getNetwork: jest.fn().mockReturnValue({
        chainId: "8453",
        protocolFamily: "evm",
        networkId: "test-network",
      }),
      nativeTransfer: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("network support", () => {
    it("should support the protocol family", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
        }),
      ).toBe(true);
    });

    it("should not support other protocol families", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "other-protocol-family",
        }),
      ).toBe(false);
    });

    it("should handle invalid network objects", () => {
      expect(provider.supportsNetwork({} as Network)).toBe(false);
    });
  });

  describe("action validation", () => {
    describe("common inputs", () => {
      const CommonSchema = z.object(casinoBetParams);
      it("should validate common actions schema", () => {
        const validInput = {
          betAmount: "1.0",
          token: "ETH",
        };
        const parseResult = CommonSchema.safeParse(validInput);
        expect(parseResult.success).toBe(true);
      });
      it("should reject invalid common actions inputs", () => {
        const invalidInput = {
          betAmount: "-1.0",
          token: "BTC",
        };
        const parseResult = CommonSchema.safeParse(invalidInput);
        expect(parseResult.success).toBe(false);
      });
    });

    describe("Coin Toss", () => {
      it("should validate Coin Toss action schema", () => {
        const validInput = {
          face: "TAILS",
        };
        const parseResult = CoinTossSchema.safeParse(validInput);
        expect(parseResult.success).toBe(true);
      });
      it("should reject invalid Coin Toss action input", () => {
        const invalidInput = {
          face: "BAR",
        };
        const parseResult = CoinTossSchema.safeParse(invalidInput);
        expect(parseResult.success).toBe(false);
      });
    });
    describe("Dice", () => {
      it("should validate Dice action schema", () => {
        const validInput = {
          number: 38,
        };
        const parseResult = DiceSchema.safeParse(validInput);
        expect(parseResult.success).toBe(true);
      });
      it("should reject invalid Dice action input", () => {
        const invalidInput = {
          number: 290,
        };
        const parseResult = DiceSchema.safeParse(invalidInput);
        expect(parseResult.success).toBe(false);
      });
    });
    describe("Roulette", () => {
      it("should validate Roulette action schema", () => {
        const validInput = {
          numbers: [14, 32],
        };
        const parseResult = RouletteSchema.safeParse(validInput);
        expect(parseResult.success).toBe(true);
      });
      it("should reject invalid Roulette action input", () => {
        const invalidInput = {
          numbers: [50],
        };
        const parseResult = RouletteSchema.safeParse(invalidInput);
        expect(parseResult.success).toBe(false);
      });
    });
    describe("Get bet", () => {
      it("should validate Get bet action schema", () => {
        const validInput = {
          hash: "0x34a67177f658a0d45de95c6f34c3b9a868bee1ebf1f612a635ddf5e6c262376e",
        };
        const parseResult = GetBetSchema.safeParse(validInput);
        expect(parseResult.success).toBe(true);
      });
      it("should reject invalid Get bet action input", () => {
        const invalidInput = {
          hash: "0x00",
        };
        const parseResult = GetBetSchema.safeParse(invalidInput);
        expect(parseResult.success).toBe(false);
      });
    });
    describe("Get bets", () => {
      it("should validate Get bets action schema", () => {
        const validInput = {
          bettor: "0x057BcBF736DADD774A8A45A185c1697F4cF7517D",
          game: "coin-toss",
        };
        const parseResult = GetBetsSchema.safeParse(validInput);
        expect(parseResult.success).toBe(true);
      });
      it("should reject invalid Get bets action input", () => {
        const invalidInput = {
          bettor: "0x057",
          game: "poker",
        };
        const parseResult = GetBetsSchema.safeParse(invalidInput);
        expect(parseResult.success).toBe(false);
      });
    });
  });

  describe("Coin Toss action", () => {
    it("should execute Coin Toss action with wallet provider", async () => {
      const args = {
        betAmount: "1.0",
        token: "ETH",
        face: "HEADS" as COINTOSS_FACE,
      };
      const result = await provider.coinToss(mockWalletProvider, args);
      expect(result).toContain("id");
      expect(mockWalletProvider.getNetwork).toHaveBeenCalled();
      expect(mockWalletProvider.getAddress).toHaveBeenCalled();
      expect(mockWalletProvider.readContract).toHaveBeenCalled();
      expect(mockWalletProvider.sendTransaction).toHaveBeenCalled();
    });
  });
});
