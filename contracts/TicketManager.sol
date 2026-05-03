// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TicketManager is ERC721URIStorage, Ownable, ReentrancyGuard {
    enum TicketStatus { Active, Redeemed, Cancelled }

    struct Ticket {
        string eventId;
        string eventName;
        string venue;
        string date;
        string attendeeName;
        uint256 pricePaid;
        TicketStatus status;
        uint256 mintTimestamp;
    }

    uint256 private _nextTokenId;
    uint256 public platformFee;
    address public platformWallet;

    mapping(uint256 => Ticket) public tickets;
    mapping(address => bool) public authorizedRedeemers;

    event TicketPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        string eventId,
        string eventName,
        uint256 pricePaid
    );

    event TicketRedeemed(uint256 indexed tokenId, address indexed redeemer);

    constructor(
        address _platformWallet,
        uint256 _platformFee
    ) ERC721("EthTix Ticket", "ETHTIX") Ownable(msg.sender) {
        platformWallet = _platformWallet;
        platformFee = _platformFee;
    }

    function purchaseTicket(
        string memory eventId,
        string memory eventName,
        string memory venue,
        string memory date,
        string memory attendeeName,
        string memory _tokenURI
    ) external payable nonReentrant returns (uint256) {
        require(msg.value >= platformFee, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);

        tickets[tokenId] = Ticket({
            eventId: eventId,
            eventName: eventName,
            venue: venue,
            date: date,
            attendeeName: attendeeName,
            pricePaid: msg.value,
            status: TicketStatus.Active,
            mintTimestamp: block.timestamp
        });

        // Forward platform fee to platform wallet
        (bool sent, ) = payable(platformWallet).call{value: platformFee}("");
        require(sent, "Platform fee transfer failed");

        // Refund excess payment
        uint256 excess = msg.value - platformFee;
        if (excess > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: excess}("");
            require(refunded, "Refund failed");
        }

        emit TicketPurchased(tokenId, msg.sender, eventId, eventName, msg.value);
        return tokenId;
    }

    function mintFreeTicket(
        address to,
        string memory eventId,
        string memory eventName,
        string memory venue,
        string memory date,
        string memory attendeeName,
        string memory _tokenURI
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _tokenURI);

        tickets[tokenId] = Ticket({
            eventId: eventId,
            eventName: eventName,
            venue: venue,
            date: date,
            attendeeName: attendeeName,
            pricePaid: 0,
            status: TicketStatus.Active,
            mintTimestamp: block.timestamp
        });

        emit TicketPurchased(tokenId, to, eventId, eventName, 0);
        return tokenId;
    }

    function redeemTicket(uint256 tokenId) external {
        require(tokenId < _nextTokenId, "Token does not exist");
        require(
            ownerOf(tokenId) == msg.sender ||
            authorizedRedeemers[msg.sender] ||
            owner() == msg.sender,
            "Not authorized to redeem"
        );
        require(
            tickets[tokenId].status == TicketStatus.Active,
            "Ticket not active"
        );

        tickets[tokenId].status = TicketStatus.Redeemed;
        emit TicketRedeemed(tokenId, msg.sender);
    }

    function verifyTicket(uint256 tokenId) external view returns (
        bool isValid,
        string memory eventId,
        string memory eventName,
        string memory attendeeName,
        TicketStatus status
    ) {
        require(tokenId < _nextTokenId, "Token does not exist");
        Ticket memory t = tickets[tokenId];
        return (
            t.status == TicketStatus.Active,
            t.eventId,
            t.eventName,
            t.attendeeName,
            t.status
        );
    }

    function getTicketInfo(uint256 tokenId) external view returns (Ticket memory) {
        require(tokenId < _nextTokenId, "Token does not exist");
        return tickets[tokenId];
    }

    function setAuthorizedRedeemer(address redeemer, bool authorized) external onlyOwner {
        authorizedRedeemers[redeemer] = authorized;
    }

    function setPlatformFee(uint256 _fee) external onlyOwner {
        platformFee = _fee;
    }

    function setPlatformWallet(address _wallet) external onlyOwner {
        platformWallet = _wallet;
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        (bool sent, ) = payable(owner()).call{value: balance}("");
        require(sent, "Withdrawal failed");
    }

    function totalTickets() external view returns (uint256) {
        return _nextTokenId;
    }
}
