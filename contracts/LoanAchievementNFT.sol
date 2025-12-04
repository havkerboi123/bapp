// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title LoanAchievementNFT
 * @notice NFT contract that mints achievement NFTs when partners pay back loans
 * @dev Each NFT represents a successful loan repayment
 */
contract LoanAchievementNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Mapping from loan ID to token ID (to prevent duplicate minting)
    mapping(bytes32 => uint256) public loanToTokenId;
    
    // Mapping from token ID to loan ID
    mapping(uint256 => bytes32) public tokenIdToLoan;
    
    // Base URI for token metadata
    string private _baseTokenURI;
    
    // Event emitted when an achievement NFT is minted
    event AchievementMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        bytes32 indexed loanId,
        uint256 amount,
        uint256 timestamp
    );
    
    constructor(
        address initialOwner,
        string memory initialBaseTokenURI
    ) ERC721("Loan Repayment Achievement", "LRA") Ownable(initialOwner) {
        _baseTokenURI = initialBaseTokenURI;
    }
    
    /**
     * @notice Mint an achievement NFT for a successful loan repayment
     * @param recipient The address that paid back the loan (partner)
     * @param loanId The unique ID of the loan that was paid back
     * @param amount The amount that was repaid (in wei)
     * @return tokenId The ID of the newly minted NFT
     */
    function mintAchievement(
        address recipient,
        bytes32 loanId,
        uint256 amount
    ) external onlyOwner returns (uint256) {
        require(recipient != address(0), "Invalid recipient address");
        require(loanToTokenId[loanId] == 0, "NFT already minted for this loan");
        
        // Increment token ID counter
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        // Store mapping
        loanToTokenId[loanId] = tokenId;
        tokenIdToLoan[tokenId] = loanId;
        
        // Mint the NFT
        _safeMint(recipient, tokenId);
        
        // Set token URI (metadata will be generated off-chain)
        string memory tokenURI = string(abi.encodePacked(
            _baseTokenURI,
            "/",
            _toString(tokenId)
        ));
        _setTokenURI(tokenId, tokenURI);
        
        // Emit event
        emit AchievementMinted(
            tokenId,
            recipient,
            loanId,
            amount,
            block.timestamp
        );
        
        return tokenId;
    }
    
    /**
     * @notice Check if an NFT has been minted for a specific loan
     * @param loanId The loan ID to check
     * @return true if NFT exists, false otherwise
     */
    function hasAchievement(bytes32 loanId) external view returns (bool) {
        return loanToTokenId[loanId] != 0;
    }
    
    /**
     * @notice Get the token ID for a specific loan
     * @param loanId The loan ID
     * @return tokenId The token ID (0 if not minted)
     */
    function getTokenIdForLoan(bytes32 loanId) external view returns (uint256) {
        return loanToTokenId[loanId];
    }
    
    /**
     * @notice Update the base token URI
     * @param newBaseTokenURI The new base URI
     */
    function setBaseTokenURI(string memory newBaseTokenURI) external onlyOwner {
        _baseTokenURI = newBaseTokenURI;
    }
    
    /**
     * @notice Get the base token URI
     */
    function baseTokenURI() external view returns (string memory) {
        return _baseTokenURI;
    }
    
    /**
     * @notice Get total number of NFTs minted
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    /**
     * @notice Helper function to convert uint256 to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
