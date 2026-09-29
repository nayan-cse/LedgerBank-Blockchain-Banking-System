// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Educational native-ETH vault. Local test currency, not fiat banking.
contract LedgerBank {
    address public immutable administrator;
    bool public paused;
    uint256 private entered = 1;
    uint256 public customerCount;
    uint256 public accountCount;
    uint256 public transactionCount;
    uint256 public totalLiabilities;
    struct Account { uint64 number; uint64 openedAt; bool frozen; uint256 balance; }
    mapping(address => bytes32) public customers;
    mapping(address => Account) public accounts;
    mapping(uint256 => address) public accountOwners;
    // A successful request is unique per initiating wallet across all money operations.
    mapping(address => mapping(bytes32 => uint256)) public requestSequences;

    event CustomerRegistered(address indexed customer, bytes32 identityCommitment);
    event AccountOpened(address indexed owner, uint256 indexed number);
    event AccountFrozen(address indexed owner, bool frozen);
    event PauseChanged(bool paused);
    // operation: 0 deposit, 1 withdrawal, 2 internal transfer. Zero address means outside ledger.
    event BankTransaction(uint256 indexed sequence, address indexed sender, address indexed recipient,
        uint8 operation, uint256 amount, uint256 senderBalanceAfter, uint256 recipientBalanceAfter,
        bytes32 requestId, bytes32 memoHash);

    constructor(address admin) { require(admin != address(0), "Zero administrator"); administrator = admin; }
    modifier onlyAdministrator() { require(msg.sender == administrator, "Administrator only"); _; }
    modifier whenRunning() { require(!paused, "Bank is paused"); _; }
    modifier nonReentrant() { require(entered == 1, "Reentrant call"); entered = 2; _; entered = 1; }
    function requireActive(address owner) private view {
        require(accounts[owner].number != 0, "Account does not exist");
        require(!accounts[owner].frozen, "Account is frozen");
    }
    function beginRequest(bytes32 requestId) private returns (uint256 sequence) {
        require(requestId != bytes32(0), "Empty request ID");
        require(requestSequences[msg.sender][requestId] == 0, "Request already executed");
        sequence = ++transactionCount;
        requestSequences[msg.sender][requestId] = sequence;
    }
    function registerCustomer(bytes32 identityCommitment) external whenRunning {
        require(msg.sender != administrator, "Administrator reserved");
        require(customers[msg.sender] == bytes32(0), "Customer already registered");
        require(identityCommitment != bytes32(0), "Empty identity commitment");
        customers[msg.sender] = identityCommitment;
        ++customerCount;
        emit CustomerRegistered(msg.sender, identityCommitment);
    }
    function openAccount() external whenRunning {
        require(customers[msg.sender] != bytes32(0), "Register customer first");
        require(accounts[msg.sender].number == 0, "Account already exists");
        uint256 number = ++accountCount;
        require(number <= type(uint64).max, "Account limit reached");
        accounts[msg.sender] = Account(uint64(number), uint64(block.timestamp), false, 0);
        accountOwners[number] = msg.sender;
        emit AccountOpened(msg.sender, number);
    }
    function deposit(bytes32 requestId, bytes32 memoHash) external payable whenRunning nonReentrant {
        requireActive(msg.sender);
        require(msg.value > 0, "Amount must be positive");
        uint256 sequence = beginRequest(requestId);
        accounts[msg.sender].balance += msg.value;
        totalLiabilities += msg.value;
        emit BankTransaction(sequence, address(0), msg.sender, 0, msg.value, 0,
            accounts[msg.sender].balance, requestId, memoHash);
    }
    function withdraw(uint256 amount, bytes32 requestId, bytes32 memoHash) external whenRunning nonReentrant {
        requireActive(msg.sender);
        require(amount > 0, "Amount must be positive");
        require(accounts[msg.sender].balance >= amount, "Insufficient bank balance");
        uint256 sequence = beginRequest(requestId);
        // Checks-effects-interactions: external payment occurs after accounting effects.
        accounts[msg.sender].balance -= amount;
        totalLiabilities -= amount;
        (bool success,) = payable(msg.sender).call{value:amount}("");
        require(success, "Withdrawal payment failed");
        emit BankTransaction(sequence, msg.sender, address(0), 1, amount,
            accounts[msg.sender].balance, 0, requestId, memoHash);
    }
    function transfer(address recipient, uint256 amount, bytes32 requestId, bytes32 memoHash) external whenRunning nonReentrant {
        requireActive(msg.sender); requireActive(recipient);
        require(recipient != msg.sender, "Cannot transfer to yourself");
        require(amount > 0, "Amount must be positive");
        require(accounts[msg.sender].balance >= amount, "Insufficient bank balance");
        uint256 sequence = beginRequest(requestId);
        accounts[msg.sender].balance -= amount;
        accounts[recipient].balance += amount;
        emit BankTransaction(sequence, msg.sender, recipient, 2, amount,
            accounts[msg.sender].balance, accounts[recipient].balance, requestId, memoHash);
    }
    function setFrozen(address owner, bool frozen) external onlyAdministrator {
        require(accounts[owner].number != 0, "Account does not exist");
        require(accounts[owner].frozen != frozen, "Freeze status unchanged");
        accounts[owner].frozen = frozen;
        emit AccountFrozen(owner, frozen);
    }
    function setPaused(bool value) external onlyAdministrator {
        require(paused != value, "Pause status unchanged");
        paused = value; emit PauseChanged(value);
    }
    function balanceOf(address owner) external view returns (uint256) { return accounts[owner].balance; }
    /// @dev Forced ETH may create surplus; backing >= liabilities, not always equality.
    function backing() external view returns (uint256 assets, uint256 liabilities, bool solvent) {
        return (address(this).balance, totalLiabilities, address(this).balance >= totalLiabilities);
    }
    // A direct send must not create an uncredited deposit. Use deposit().
    receive() external payable { revert("Use deposit"); }
    fallback() external payable { revert("Unknown operation"); }
}
