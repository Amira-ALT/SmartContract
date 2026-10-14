
 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.20;

 import "@openzeppelin/contracts/access/Ownable.sol";
 import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
 import "./EventTicket.sol";

 contract TicketMarket is Ownable, ReentrancyGuard {

     EventTicket public ticket;
     address payable public organizer;

     uint256 public constant MAX_RESALE_BPS = 11000;
     uint256 public constant BPS_DENOMINATOR = 10000;
     uint256 public constant ORGANIZER_FEE_BPS = 200;

     struct Listing {
         address payable seller;
         uint256 price;
         bool active;
     }

     mapping(uint256 => Listing) public listings;

     constructor(
         address ticketAddress,
         address payable organizerAddress
     ) Ownable(msg.sender) {
         require(ticketAddress != address(0), "Invalid ticket");
         require(organizerAddress != address(0), "Invalid organizer");

         ticket = EventTicket(ticketAddress);
         organizer = organizerAddress;
     }

     function list(
         uint256 tokenId,
         uint256 price
     ) external {
         require(
             ticket.ownerOf(tokenId) == msg.sender,
             "Not ticket owner"
         );

         uint256 originalPrice = ticket.initialPrice(tokenId);

         uint256 maxPrice =
             originalPrice * MAX_RESALE_BPS / BPS_DENOMINATOR;

         require(price > 0, "Price must be positive");
         require(price <= maxPrice, "Resale price too high");

         listings[tokenId] = Listing(
             payable(msg.sender),
             price,
             true
         );
     }

     function buy(uint256 tokenId)
         external
         payable
         nonReentrant
     {
         Listing memory item = listings[tokenId];

         require(item.active, "Ticket not for sale");
         require(msg.sender != item.seller, "Cannot buy own ticket");
         require(msg.value == item.price, "Incorrect payment");

         listings[tokenId].active = false;

         uint256 fee =
             item.price * ORGANIZER_FEE_BPS / BPS_DENOMINATOR;

         uint256 sellerAmount = item.price - fee;

         ticket.safeTransferFrom(
             item.seller,
             msg.sender,
             tokenId
         );

         (bool sellerPaid, ) = item.seller.call{
             value: sellerAmount
         }("");

         require(sellerPaid, "Seller payment failed");

         (bool organizerPaid, ) = organizer.call{
             value: fee
         }("");

         require(organizerPaid, "Organizer payment failed");
     }
 }
