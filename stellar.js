
class StellarManager {
    constructor() {
        this.server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
        this.network = StellarSdk.Networks.TESTNET;
        this.networkPassphrase = StellarSdk.Networks.TESTNET;
        
        console.log('Stellar Manager initialized for TESTNET');
    }

    // Switch to mainnet (for production)
    switchToMainnet() {
        this.server = new StellarSdk.Server('https://horizon.stellar.org');
        this.network = StellarSdk.Networks.PUBLIC;
        this.networkPassphrase = StellarSdk.Networks.PUBLIC;
        console.log('Switched to Stellar MAINNET');
    }

    async getAccountBalance(publicKey) {
        try {
            const account = await this.server.loadAccount(publicKey);
            
            const xlmBalance = account.balances.find(
                balance => balance.asset_type === 'native'
            );
            
            return xlmBalance ? parseFloat(xlmBalance.balance).toFixed(7) : '0';
        } catch (error) {
            console.error('Error loading account balance:', error);
            
            if (error.response && error.response.status === 404) {
                return 'Account not found';
            }
            throw error;
        }
    }

    async getRecentTransactions(publicKey, limit = 10) {
        try {
            const transactions = await this.server
                .transactions()
                .forAccount(publicKey)
                .order('desc')
                .limit(limit)
                .call();

            return transactions.records.map(tx => ({
                hash: tx.hash,
                date: tx.created_at,
                type: 'Transaction',
                amount: 'N/A',
                successful: tx.successful
            }));
        } catch (error) {
            console.error('Error loading transactions:', error);
            return [];
        }
    }

    async sendPayment(sourcePublicKey, destinationPublicKey, amount, memo = '') {
        try {
            console.log('Preparing payment transaction...');
            
            const sourceAccount = await this.server.loadAccount(sourcePublicKey);
            
            let createAccount = false;
            try {
                await this.server.loadAccount(destinationPublicKey);
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    createAccount = true;
                    console.log('Destination account not found, will create account');
                }
            }

            const fee = await this.server.fetchBaseFee();

            const transactionBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
                fee: fee.toString(),
                networkPassphrase: this.networkPassphrase,
            });

            if (createAccount) {
                if (parseFloat(amount) < 1) {
                    throw new Error('Minimum 1 XLM required to create new account');
                }
                
                transactionBuilder.addOperation(
                    StellarSdk.Operation.createAccount({
                        destination: destinationPublicKey,
                        startingBalance: amount.toString(),
                    })
                );
            } else {
                transactionBuilder.addOperation(
                    StellarSdk.Operation.payment({
                        destination: destinationPublicKey,
                        asset: StellarSdk.Asset.native(),
                        amount: amount.toString(),
                    })
                );
            }

            if (memo) {
                transactionBuilder.addMemo(StellarSdk.Memo.text(memo));
            }

            const transaction = transactionBuilder.setTimeout(30).build();

            const transactionXDR = transaction.toXDR();

            console.log('Requesting signature from wallet...');
            
            const signedXDR = await window.xBullSDK.signXDR(transactionXDR, {
                network: this.networkPassphrase,
                publicKey: sourcePublicKey
            });

            console.log('Transaction signed, submitting to network...');

            const signedTransaction = StellarSdk.TransactionBuilder.fromXDR(
                signedXDR,
                this.networkPassphrase
            );

            const result = await this.server.submitTransaction(signedTransaction);

            console.log('Transaction successful:', result.hash);

            return {
                success: true,
                hash: result.hash,
                ledger: result.ledger,
                result: result
            };

        } catch (error) {
            console.error('Payment failed:', error);
            
            let errorMessage = 'Unknown error occurred';
            
            if (error.response && error.response.data) {
                const errorData = error.response.data;
                if (errorData.extras && errorData.extras.result_codes) {
                    errorMessage = `Transaction failed: ${errorData.extras.result_codes.transaction}`;
                    if (errorData.extras.result_codes.operations) {
                        errorMessage += ` - ${errorData.extras.result_codes.operations.join(', ')}`;
                    }
                }
            } else {
                errorMessage = error.message;
            }

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    async fundTestAccount(publicKey) {
        try {
            console.log('Funding account with friendbot...');
            
            const response = await fetch(
                `https://friendbot.stellar.org?addr=${publicKey}`
            );
            
            if (response.ok) {
                console.log('Account funded successfully');
                return true;
            } else {
                throw new Error('Friendbot funding failed');
            }
        } catch (error) {
            console.error('Friendbot funding error:', error);
            return false;
        }
    }

    async getAccountInfo(publicKey) {
        try {
            const account = await this.server.loadAccount(publicKey);
            
            return {
                accountId: account.accountId(),
                sequence: account.sequence,
                balances: account.balances.map(balance => ({
                    assetType: balance.asset_type,
                    assetCode: balance.asset_code || 'XLM',
                    balance: balance.balance,
                    limit: balance.limit
                })),
                signers: account.signers,
                flags: account.flags,
                homeDomain: account.home_domain,
                thresholds: account.thresholds
            };
        } catch (error) {
            console.error('Error getting account info:', error);
            throw error;
        }
    }

    async createTrustline(sourcePublicKey, assetCode, assetIssuer, limit = null) {
        try {
            console.log(`Creating trustline for ${assetCode}:${assetIssuer}`);
            
            const sourceAccount = await this.server.loadAccount(sourcePublicKey);
            const asset = new StellarSdk.Asset(assetCode, assetIssuer);
            const fee = await this.server.fetchBaseFee();

            const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
                fee: fee.toString(),
                networkPassphrase: this.networkPassphrase,
            })
                .addOperation(
                    StellarSdk.Operation.changeTrust({
                        asset: asset,
                        limit: limit ? limit.toString() : undefined,
                    })
                )
                .setTimeout(30)
                .build();

            const transactionXDR = transaction.toXDR();

            const signedXDR = await window.xBullSDK.signXDR(transactionXDR, {
                network: this.networkPassphrase,
                publicKey: sourcePublicKey
            });

            const signedTransaction = StellarSdk.TransactionBuilder.fromXDR(
                signedXDR,
                this.networkPassphrase
            );

            const result = await this.server.submitTransaction(signedTransaction);

            return {
                success: true,
                hash: result.hash,
                result: result
            };

        } catch (error) {
            console.error('Trustline creation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getTradingPairs() {
        try {
            const assets = await this.server.assets().call();
            return assets.records.slice(0, 20).map(asset => ({
                code: asset.asset_code,
                issuer: asset.asset_issuer,
                amount: asset.amount,
                numAccounts: asset.num_accounts
            }));
        } catch (error) {
            console.error('Error fetching trading pairs:', error);
            return [];
        }
    }

    isValidStellarAddress(address) {
        try {
            StellarSdk.Keypair.fromPublicKey(address);
            return true;
        } catch (error) {
            return false;
        }
    }

    formatAmount(amount, decimals = 7) {
        return parseFloat(amount).toFixed(decimals);
    }

    stroopsToXLM(stroops) {
        return (parseFloat(stroops) / 10000000).toFixed(7);
    }

    xlmToStroops(xlm) {
        return Math.round(parseFloat(xlm) * 10000000);
    }
}

let stellarManager;

function initializeStellarManager() {
    stellarManager = new StellarManager();
    console.log('Stellar Manager ready');
}
window.initializeStellarManager = initializeStellarManager;

function initializeWalletManager() {
    walletManager = new WalletManager();
    console.log('Wallet Manager initialized');
}
window.initializeWalletManager = initializeWalletManager;

window.stellarManager = stellarManager;

const StellarUtils = {
    generateKeypair() {
        return StellarSdk.Keypair.random();
    },

    getNetworkType() {
        return stellarManager ? 
            (stellarManager.networkPassphrase === StellarSdk.Networks.TESTNET ? 'testnet' : 'mainnet') : 
            'unknown';
    },

    formatAddress(address, startChars = 8, endChars = 8) {
        if (!address) return '';
        if (address.length <= startChars + endChars) return address;
        return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
    },

    validateAmount(amount) {
        const num = parseFloat(amount);
        if (isNaN(num) || num <= 0) {
            throw new Error('Invalid amount');
        }
        if (num < 0.0000001) {
            throw new Error('Amount too small (minimum 0.0000001 XLM)');
        }
        return num.toFixed(7);
    }
};

window.StellarUtils = StellarUtils;