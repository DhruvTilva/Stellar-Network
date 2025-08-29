
class WalletManager {
    constructor() {
        this.isConnected = false;
        this.publicKey = 'GCJMDI3HPUJGTBXIOFE46FUCGVQXLVIH3M2MKGFRRW45W4WNV6R3Z7DU';
        this.walletType = 'xbull';
        this.stellarNetwork = 'testnet'; 
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('connect-btn').addEventListener('click', () => this.connectWallet());
        document.getElementById('disconnect-btn').addEventListener('click', () => this.disconnectWallet());
        document.getElementById('payment-form').addEventListener('submit', (e) => this.handlePaymentSubmit(e));
    }

    isXBullAvailable() {
        return typeof window.xBullSDK !== 'undefined';
    }

    async connectWallet() {
        try {
            this.showStatus('Connecting to xBull Wallet...', 'info');
            
            if (!this.isXBullAvailable()) {
                throw new Error('xBull Wallet not detected. Please install the xBull browser extension.');
            }

            const permissions = await window.xBullSDK.connect({
                canRequestPublicKey: true,
                canRequestSign: true
            });

            if (permissions) {
                this.publicKey = await window.xBullSDK.getPublicKey();
                this.isConnected = true;
                
                this.showStatus('Successfully connected to xBull Wallet!', 'success');
                this.updateWalletUI();
                
                await this.loadAccountData();
                
            } else {
                throw new Error('Connection rejected by user');
            }

        } catch (error) {
            console.error('Wallet connection error:', error);
            this.showStatus(`Connection failed: ${error.message}`, 'error');
        }
    }

    async disconnectWallet() {
        try {
            this.isConnected = false;
            this.publicKey = null;
            
            this.showStatus('Wallet disconnected', 'info');
            this.updateWalletUI();
            
        } catch (error) {
            console.error('Disconnect error:', error);
            this.showStatus(`Disconnect failed: ${error.message}`, 'error');
        }
    }

    updateWalletUI() {
        const walletStatus = document.getElementById('wallet-status');
        const walletInfo = document.getElementById('wallet-info');
        const paymentSection = document.getElementById('payment-section');
        const historySection = document.getElementById('history-section');

        if (this.isConnected && this.publicKey) {
            walletStatus.classList.add('hidden');
            walletInfo.classList.remove('hidden');
            paymentSection.classList.remove('hidden');
            historySection.classList.remove('hidden');
            
            // document.getElementById('wallet-address').textContent = 
            //     this.publicKey.substring(0, 8) + '...' + this.publicKey.substring(this.publicKey.length - 8);
            const walletAddress = this.publicKey;
const displayAddress = walletAddress.substring(0, 8) + '...' + walletAddress.substring(walletAddress.length - 8);

const walletElement = document.getElementById('wallet-address');
walletElement.textContent = displayAddress;
walletElement.setAttribute('title', walletAddress); // tooltip
            
        } else {
            walletStatus.classList.remove('hidden');
            walletInfo.classList.add('hidden');
            paymentSection.classList.add('hidden');
            historySection.classList.add('hidden');
        }
    }

    async loadAccountData() {
        if (!this.publicKey) return;

        try {
            const balance = await stellarManager.getAccountBalance(this.publicKey);
            document.getElementById('xlm-balance').textContent = `${balance} XLM`;
            
            const transactions = await stellarManager.getRecentTransactions(this.publicKey);
            this.displayTransactions(transactions);
            
        } catch (error) {
            console.error('Error loading account data:', error);
            document.getElementById('xlm-balance').textContent = 'Error loading balance';
        }
    }

    async handlePaymentSubmit(event) {
        event.preventDefault();
        
        if (!this.isConnected) {
            this.showStatus('Please connect your wallet first', 'error');
            return;
        }

        const destination = document.getElementById('destination').value.trim();
        const amount = document.getElementById('amount').value.trim();
        const memo = document.getElementById('memo').value.trim();

        if (!destination || !amount) {
            this.showStatus('Please fill in all required fields', 'error');
            return;
        }

        if (parseFloat(amount) <= 0) {
            this.showStatus('Amount must be greater than 0', 'error');
            return;
        }

        try {
            this.showStatus('Preparing payment...', 'info');
            
            const result = await stellarManager.sendPayment(
                this.publicKey,
                destination,
                amount,
                memo
            );

            if (result.success) {
                this.showStatus('Payment sent successfully!', 'success');
                
                document.getElementById('payment-form').reset();
                
                await this.loadAccountData();
            } else {
                throw new Error(result.error || 'Payment failed');
            }

        } catch (error) {
            console.error('Payment error:', error);
            this.showStatus(`Payment failed: ${error.message}`, 'error');
        }
    }

    displayTransactions(transactions) {
        const transactionList = document.getElementById('transaction-list');
        
        if (!transactions || transactions.length === 0) {
            transactionList.innerHTML = '<p>No recent transactions found.</p>';
            return;
        }

        const transactionHTML = transactions.map(tx => `
            <div class="transaction-item">
                <div class="transaction-type">${tx.type}</div>
                <div class="transaction-amount">${tx.amount} XLM</div>
                <div class="transaction-date">${new Date(tx.date).toLocaleDateString()}</div>
                <div class="transaction-hash" style="font-family: monospace; font-size: 0.8rem; color: #666;">
                    ${tx.hash ? tx.hash.substring(0, 16) + '...' : 'N/A'}
                </div>
            </div>
        `).join('');

        transactionList.innerHTML = transactionHTML;
    }

    showStatus(message, type = 'info') {
        const statusContainer = document.getElementById('status-messages');
        
        const statusDiv = document.createElement('div');
        statusDiv.className = `status-message status-${type}`;
        statusDiv.textContent = message;
        
        statusContainer.appendChild(statusDiv);
        
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.parentNode.removeChild(statusDiv);
            }
        }, 5000);
        
        console[type === 'error' ? 'error' : 'log'](`[Wallet] ${message}`);
    }

    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            publicKey: this.publicKey,
            walletType: this.walletType
        };
    }
}

class StellarWalletsKitManager {
    constructor() {
        this.kit = null;
        this.isConnected = false;
        this.publicKey = null;
    }

    async initializeKit() {
        try {
           
            
            console.log('Stellar Wallets Kit initialized');
        } catch (error) {
            console.error('Failed to initialize Stellar Wallets Kit:', error);
        }
    }

    async connectWithKit() {
        if (!this.kit) {
            throw new Error('Stellar Wallets Kit not initialized');
        }

        try {
            const { address } = await this.kit.getAddress();
            this.publicKey = address;
            this.isConnected = true;
            return address;
        } catch (error) {
            throw new Error(`Kit connection failed: ${error.message}`);
        }
    }
}

let walletManager;

function initializeWalletManager() {
    walletManager = new WalletManager();
    console.log('Wallet Manager initialized');
}

window.walletManager = walletManager;