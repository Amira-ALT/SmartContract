// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./EventTicket.sol";

contract EntryValidator is Ownable {
    EventTicket public ticket;

    mapping(uint256 => bool) public usedTickets;

    event TicketValidated(uint256 indexed tokenId, address indexed attendee);

    constructor(address ticketAddress) Ownable(msg.sender) {
        require(ticketAddress != address(0), "Invalid ticket");
        ticket = EventTicket(ticketAddress);
    }

    function validateEntry(uint256 tokenId) external onlyOwner {
        // ownerOf reverts for tickets that were never minted.
        address attendee = ticket.ownerOf(tokenId);

        require(!usedTickets[tokenId], "Ticket already used");

        usedTickets[tokenId] = true;

        emit TicketValidated(tokenId, attendee);
    }
}
