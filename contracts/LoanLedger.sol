// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LoanLedger
 * @notice Simple contract to record loans on Base chain for tamper-proof proof
 */
contract LoanLedger {
    struct LoanRecord {
        address owner;
        address partner;
        uint256 amount; // Amount in wei (will store PKR amount * 1e18 for precision)
        uint256 timestamp;
        string description;
        uint256 loanDate; // Unix timestamp
        uint256 expectedReturnDate; // Unix timestamp
    }

    // Mapping from loan ID to loan record
    mapping(bytes32 => LoanRecord) public loans;
    
    // Array of all loan IDs for a given owner
    mapping(address => bytes32[]) public ownerLoans;
    
    // Event emitted when a loan is recorded
    event LoanRecorded(
        bytes32 indexed loanId,
        address indexed owner,
        address indexed partner,
        uint256 amount,
        uint256 timestamp,
        string description,
        uint256 loanDate,
        uint256 expectedReturnDate
    );

    /**
     * @notice Record a loan on-chain
     * @param partner The wallet address of the partner who received the loan
     * @param amount The loan amount (in PKR, will be stored as amount * 1e18)
     * @param description Optional description of the loan
     * @param loanDate Unix timestamp of loan date
     * @param expectedReturnDate Unix timestamp of expected return date
     * @return loanId The unique ID of the recorded loan
     */
    function recordLoan(
        address partner,
        uint256 amount,
        string memory description,
        uint256 loanDate,
        uint256 expectedReturnDate
    ) external returns (bytes32) {
        require(partner != address(0), "Invalid partner address");
        require(amount > 0, "Amount must be greater than 0");
        require(msg.sender != partner, "Cannot loan to yourself");

        // Generate unique loan ID
        bytes32 loanId = keccak256(
            abi.encodePacked(
                msg.sender,
                partner,
                amount,
                block.timestamp,
                block.prevrandao
            )
        );

        // Store loan record
        loans[loanId] = LoanRecord({
            owner: msg.sender,
            partner: partner,
            amount: amount * 1e18, // Convert PKR to wei-like precision
            timestamp: block.timestamp,
            description: description,
            loanDate: loanDate,
            expectedReturnDate: expectedReturnDate
        });

        // Add to owner's loan list
        ownerLoans[msg.sender].push(loanId);

        // Emit event
        emit LoanRecorded(
            loanId,
            msg.sender,
            partner,
            amount * 1e18,
            block.timestamp,
            description,
            loanDate,
            expectedReturnDate
        );

        return loanId;
    }

    /**
     * @notice Get loan record by ID
     */
    function getLoan(bytes32 loanId) external view returns (LoanRecord memory) {
        return loans[loanId];
    }

    /**
     * @notice Get all loan IDs for an owner
     */
    function getOwnerLoanIds(address owner) external view returns (bytes32[] memory) {
        return ownerLoans[owner];
    }

    /**
     * @notice Get total number of loans for an owner
     */
    function getOwnerLoanCount(address owner) external view returns (uint256) {
        return ownerLoans[owner].length;
    }
}

