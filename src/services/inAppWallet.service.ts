import { Keypair } from "@stellar/stellar-sdk";
import { userRepository } from "../repositories/user.repository";
import { logger } from "../utils/logger";
import type { UserProfile } from "../types/domain.types";

export const inAppWalletService = {
  /**
   * Generate a fresh, valid Stellar Keypair for in-app 1-click transactions
   */
  generateKeypair() {
    const pair = Keypair.random();
    return {
      publicKey: pair.publicKey(),
      secretKey: pair.secret(),
    };
  },

  /**
   * Fund a newly generated testnet wallet via Friendbot
   */
  async fundTestnetWallet(publicKey: string): Promise<boolean> {
    try {
      const response = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
      if (response.ok) {
        logger.info(`[inAppWalletService] Successfully pre-funded testnet wallet: ${publicKey}`, "Stellar");
        return true;
      }
    } catch (err) {
      logger.warn(`[inAppWalletService] Friendbot funding error for ${publicKey}:`, "Stellar");
    }
    return false;
  },

  /**
   * Ensure a single user profile has an in-app wallet provisioned
   */
  async ensureUserWallet(user: UserProfile): Promise<UserProfile> {
    if (user.walletAddress && user.inAppWalletSecret) {
      try {
        const derivedPub = Keypair.fromSecret(user.inAppWalletSecret).publicKey();
        if (derivedPub === user.walletAddress) {
          return user; // Already fully provisioned and keys match
        }
        // If they don't match, repair the profile to use the derived public key
        const updates: Partial<UserProfile> = {
          walletAddress: derivedPub,
          isInAppWallet: true,
          walletVerified: true,
        };
        await userRepository.updateUserProfile(user.uid, updates);
        logger.info(`[inAppWalletService] Repaired in-app wallet address mismatch for ${user.email}: ${derivedPub}`, "Auth");
        this.fundTestnetWallet(derivedPub);
        return { ...user, ...updates };
      } catch (e) {
        // Fall through to generate fresh keypair if secret is invalid
      }
    }

    // Generate a fresh unified keypair where publicKey and secretKey are guaranteed to match
    const { publicKey, secretKey } = this.generateKeypair();

    const updates: Partial<UserProfile> = {
      walletAddress: publicKey,
      inAppWalletSecret: secretKey,
      isInAppWallet: true,
      walletVerified: true,
      walletLinkedAt: user.walletLinkedAt || new Date().toISOString(),
    };

    try {
      await userRepository.updateUserProfile(user.uid, updates);
      logger.info(`[inAppWalletService] Auto-provisioned in-app wallet for ${user.email} (${user.role}): ${publicKey}`, "Auth");
      
      // Asynchronously trigger Friendbot funding for testnet
      this.fundTestnetWallet(publicKey);

      return {
        ...user,
        ...updates,
      };
    } catch (err: any) {
      logger.error(`[inAppWalletService] Failed to save in-app wallet for ${user.email}:`, err);
      return user;
    }
  },

  /**
   * Auto-migrate all existing registrants (System Admin, Barangay Admin, SK Official, Residents)
   */
  async migrateExistingUsers(users: UserProfile[]): Promise<UserProfile[]> {
    if (!users || users.length === 0) return users;

    const updatedList: UserProfile[] = [];
    for (const u of users) {
      if (!u.walletAddress || !u.inAppWalletSecret) {
        const updated = await this.ensureUserWallet(u);
        updatedList.push(updated);
      } else {
        updatedList.push(u);
      }
    }
    return updatedList;
  }
};
