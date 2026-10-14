
 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.20;

 import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
 import "@openzeppelin/contracts/access/Ownable.sol";

 contract EventTicket is ERC721, Ownable {

     uint256 public nextTokenId = 1;

     mapping(uint256 => uint256) public initialPrice;

     address public marketplace;

     constructor()
         ERC721("EventTicket", "ETKT")
         Ownable(msg.sender)
     {}

     function createTicket(
         address recipient,
         uint256 priceInWei
     ) public onlyOwner returns (uint256) {

         require(recipient != address(0), "Invalid recipient");
         require(priceInWei > 0, "Price must be positive");

         uint256 tokenId = nextTokenId;

         nextTokenId++;

         initialPrice[tokenId] = priceInWei;

         _safeMint(recipient, tokenId);

         return tokenId;
     }

     function setMarketplace(address market)
         public
         onlyOwner
     {
         require(marketplace == address(0), "Market already set");
         require(market != address(0), "Invalid market");

         marketplace = market;
     }

     function _update(
         address to,
         uint256 tokenId,
         address auth
     ) internal override returns (address) {

         address from = _ownerOf(tokenId);

         if (from != address(0) && to != address(0)) {
             require(
                 msg.sender == marketplace,
                 "Transfers only through marketplace"
             );
         }

         return super._update(to, tokenId, auth);
     }
 }
