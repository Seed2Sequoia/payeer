// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract Payeer is Ownable, Pausable {
    /**
     * @dev Struct to store session details.
     */
    struct Session {
        string title;
        address creator;
        address[] participants;
        string[] taunts;
        uint256 entryFee;
        address tokenAddress; // address(0) for ETH
        bool isActive;
        bool isCancelled;
        address winner;
        uint256 totalPool;
        uint256 createdAt;
        bytes32 passwordHash; // 0x0 if public
        mapping(address => bool) hasRefunded;
        mapping(address => bool) isParticipant;
    }

    /// @dev Mapping of session ID to Session struct
    mapping(uint256 => Session) public sessions;
    
    /// @dev Mapping of user address to nickname
    mapping(address => string) public nicknames;
    
    /// @dev Counter for session IDs
    uint256 public nextSessionId;
    
    /// @dev Platform fee percentage (default 1%)
    uint256 public platformFeePercentage = 1; // 1% fee
    
    /// @dev Session timeout duration (7 days)
    uint256 public constant SESSION_TIMEOUT = 7 days;

    /// @dev Emitted when a new session is created
    event SessionCreated(uint256 indexed sessionId, string title, uint256 entryFee, address tokenAddress, address creator, bool isPrivate);
    
    /// @dev Emitted when a participant joins a session
    event ParticipantJoined(uint256 indexed sessionId, address participant, string taunt);
    
    /// @dev Emitted when a winner is selected
    event WinnerSelected(uint256 indexed sessionId, address winner, uint256 prizeAmount, uint256 fee);
    
    /// @dev Emitted when a session is cancelled
    event SessionCancelled(uint256 indexed sessionId);
    
    /// @dev Emitted when platform fee is updated
    event FeeUpdated(uint256 newFee);
    
    /// @dev Emitted when a refund is claimed
    event RefundClaimed(uint256 indexed sessionId, address participant, uint256 amount);
    
    /// @dev Emitted when a user sets their nickname
    event NicknameSet(address indexed user, string nickname);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Pauses the contract.
     * Only the owner can call this function.
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract.
     * Only the owner can call this function.
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev Sets a nickname for the caller.
     * @param _nickname The desired nickname.
     */
    function setNickname(string memory _nickname) public {
        nicknames[msg.sender] = _nickname;
        emit NicknameSet(msg.sender, _nickname);
    }

    /**
     * @dev Creates a new betting session.
     * @param _title The title of the session.
     * @param _entryFee The amount of ETH/Token required to join.
     * @param _tokenAddress The token to use (address(0) for ETH).
     * @param _passwordHash keccak256 hash of password (bytes32(0) for public).
     */
    function createSession(string memory _title, uint256 _entryFee, address _tokenAddress, bytes32 _passwordHash) public whenNotPaused {
        Session storage newSession = sessions[nextSessionId];
        newSession.title = _title;
        newSession.creator = msg.sender;
        newSession.entryFee = _entryFee;
        newSession.tokenAddress = _tokenAddress;
        newSession.isActive = true;
        newSession.createdAt = block.timestamp;
        newSession.passwordHash = _passwordHash;
        
        emit SessionCreated(nextSessionId, _title, _entryFee, _tokenAddress, msg.sender, _passwordHash != bytes32(0));
        nextSessionId++;
    }

    /**
     * @dev Joins an active session.
     * @param _sessionId The ID of the session to join.
     * @param _taunt A fun message to taunt other players.
     * @param _password The password for private sessions ("" for public).
     */
    function joinSession(uint256 _sessionId, string memory _taunt, string memory _password) public payable whenNotPaused {
        Session storage session = sessions[_sessionId];
        require(session.isActive, "Session is not active");
        require(block.timestamp < session.createdAt + SESSION_TIMEOUT, "Session expired");

        if (session.passwordHash != bytes32(0)) {
            require(keccak256(abi.encodePacked(_password)) == session.passwordHash, "Incorrect password");
        }

        if (session.tokenAddress == address(0)) {
            require(msg.value == session.entryFee, "Incorrect ETH entry fee");
        } else {
            require(msg.value == 0, "Do not send ETH for token session");
            IERC20(session.tokenAddress).transferFrom(msg.sender, address(this), session.entryFee);
        }

        session.participants.push(msg.sender);
        session.taunts.push(_taunt);
        session.isParticipant[msg.sender] = true;
        session.totalPool += session.entryFee;

        emit ParticipantJoined(_sessionId, msg.sender, _taunt);
    }

    /**
     * @dev Cancels a session. Only creator can cancel.
     * @param _sessionId The ID of the session to cancel.
     */
    function cancelSession(uint256 _sessionId) public {
        Session storage session = sessions[_sessionId];
        require(msg.sender == session.creator, "Only creator can cancel");
        require(session.isActive, "Session not active");
        
        session.isActive = false;
        session.isCancelled = true;
        
        emit SessionCancelled(_sessionId);
    }

    /**
     * @dev Claims refund for a cancelled or expired session.
     * @param _sessionId The ID of the session.
     * Requirements:
     * - Session must be cancelled OR expired (7 days).
     * - Caller must be a participant.
     * - Caller must not have refunded yet.
     */
    function claimRefund(uint256 _sessionId) public whenNotPaused {
        Session storage session = sessions[_sessionId];
        
        bool isExpired = block.timestamp >= session.createdAt + SESSION_TIMEOUT;
        require(session.isCancelled || isExpired, "Session not cancelled or expired");
        require(session.isParticipant[msg.sender], "Not a participant");
        require(!session.hasRefunded[msg.sender], "Already refunded");

        session.hasRefunded[msg.sender] = true;
        uint256 refundAmount = session.entryFee;

        if (session.tokenAddress == address(0)) {
            (bool success, ) = msg.sender.call{value: refundAmount}("");
            require(success, "Refund failed");
        } else {
            IERC20(session.tokenAddress).transfer(msg.sender, refundAmount);
        }

        emit RefundClaimed(_sessionId, msg.sender, refundAmount);
    }

    /**
     * @dev Spins the wheel to select a random winner.
     * @param _sessionId The ID of the session.
     * Requirements:
     * - Session must be active.
     * - Must have at least one participant.
     */
    function spinWheel(uint256 _sessionId) public whenNotPaused {
        Session storage session = sessions[_sessionId];
        require(session.isActive, "Session is not active");
        require(session.participants.length > 0, "No participants");
        // Only creator or owner can spin? Let's say anyone for now, or maybe creator?
        // Let's stick to anyone to avoid locking funds if creator disappears.

        uint256 randomIndex = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    session.participants.length,
                    session.totalPool
                )
            )
        ) % session.participants.length;

        address winner = session.participants[randomIndex];
        session.winner = winner;
        session.isActive = false;

        uint256 fee = (session.totalPool * platformFeePercentage) / 100;
        uint256 prize = session.totalPool - fee;
        
        // Reset pool to prevent re-entrancy issues (though we update isActive first)
        session.totalPool = 0; 

        if (session.tokenAddress == address(0)) {
            // Transfer Fee to Owner (or keep in contract for withdraw)
            (bool feeSuccess, ) = owner().call{value: fee}("");
            require(feeSuccess, "Fee transfer failed");

            (bool success, ) = winner.call{value: prize}("");
            require(success, "Prize transfer failed");
        } else {
            IERC20(session.tokenAddress).transfer(owner(), fee);
            IERC20(session.tokenAddress).transfer(winner, prize);
        }

        emit WinnerSelected(_sessionId, winner, prize, fee);
    }

    /**
     * @dev Updates the platform fee percentage.
     * @param _fee The new fee percentage (0-100).
     * Requirements:
     * - Fee cannot exceed 10%.
     * - Only owner can call.
     */
    function setPlatformFee(uint256 _fee) public onlyOwner {
        require(_fee <= 10, "Fee cannot exceed 10%");
        platformFeePercentage = _fee;
        emit FeeUpdated(_fee);
    }

    /**
     * @dev Returns the list of participants for a session.
     * @param _sessionId The ID of the session.
     * @return An array of participant addresses.
     */
    function getParticipants(uint256 _sessionId) public view returns (address[] memory) {
        return sessions[_sessionId].participants;
    }

    /**
     * @dev Returns the nickname associated with a user address.
     * @param _user The address of the user.
     * @return The nickname string.
     */
    function getNickname(address _user) public view returns (string memory) {
        return nicknames[_user];
    }

    /**
     * @dev Returns the list of taunts for a session.
     * @param _sessionId The ID of the session.
     * @return An array of taunt strings.
     */
    function getTaunts(uint256 _sessionId) public view returns (string[] memory) {
        return sessions[_sessionId].taunts;
    }
    
    /**
     * @dev Returns detailed information about a session.
     * @param _sessionId The ID of the session.
     * @return title The title of the session.
     * @return creator The address of the session creator.
     * @return entryFee The entry fee amount.
     * @return tokenAddress The address of the ERC20 token (or address(0) for ETH).
     * @return isActive Whether the session is currently active.
     * @return isCancelled Whether the session has been cancelled.
     * @return winner The address of the winner (if selected).
     * @return totalPool The total amount in the pool.
     * @return participantCount The number of participants.
     */
    function getSession(uint256 _sessionId) public view returns (
        string memory title,
        address creator,
        uint256 entryFee,
        address tokenAddress,
        bool isActive,
        bool isCancelled,
        address winner,
        uint256 totalPool,
        uint256 participantCount
    ) {
        Session storage session = sessions[_sessionId];
        return (
            session.title,
            session.creator,
            session.entryFee,
            session.tokenAddress,
            session.isActive,
            session.isCancelled,
            session.winner,
            session.totalPool,
            session.participants.length
        );
    }
}
