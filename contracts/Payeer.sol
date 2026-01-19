// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Payeer {
    struct Session {
        address[] participants;
        string[] taunts;
        uint256 entryFee;
        bool isActive;
        address winner;
        uint256 totalPool;
    }

    mapping(uint256 => Session) public sessions;
    uint256 public nextSessionId;

    event SessionCreated(uint256 indexed sessionId, uint256 entryFee, address creator);
    event ParticipantJoined(uint256 indexed sessionId, address participant, string taunt);
    event WinnerSelected(uint256 indexed sessionId, address winner, uint256 prizeAmount);

    /**
     * @dev Creates a new betting session.
     * @param _entryFee The amount of ETH required to join.
     */
    function createSession(uint256 _entryFee) public {
        Session storage newSession = sessions[nextSessionId];
        newSession.entryFee = _entryFee;
        newSession.isActive = true;
        
        // Add creator as first participant? No, let them join explicitly or auto-join?
        // Proposal: Creator just creates. Must join separately to pay fee. 
        // This keeps logic cleaner.

        emit SessionCreated(nextSessionId, _entryFee, msg.sender);
        nextSessionId++;
    }

    /**
     * @dev Joins an active session. Requires sending the exact entry fee.
     * @param _sessionId The ID of the session to join.
     * @param _taunt A fun message to taunt other players.
     */
    function joinSession(uint256 _sessionId, string memory _taunt) public payable {
        Session storage session = sessions[_sessionId];
        require(session.isActive, "Session is not active");
        require(msg.value == session.entryFee, "Incorrect entry fee");

        session.participants.push(msg.sender);
        session.taunts.push(_taunt);
        session.totalPool += msg.value;

        emit ParticipantJoined(_sessionId, msg.sender, _taunt);
    }

    /**
     * @dev Selects a random winner and transfers the entire pool to them.
     * @param _sessionId The ID of the session.
     */
    function spinWheel(uint256 _sessionId) public {
        Session storage session = sessions[_sessionId];
        require(session.isActive, "Session is not active");
        require(session.participants.length > 0, "No participants");

        // Simple Randomness (Not VRF for MVP, but good enough for friends)
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

        uint256 prizeAmount = session.totalPool;
        session.totalPool = 0; // Reentrancy protection check

        (bool success, ) = winner.call{value: prizeAmount}("");
        require(success, "Transfer failed");

        emit WinnerSelected(_sessionId, winner, prizeAmount);
    }

    /**
     * @dev Returns participants of a specific session.
     */
    function getParticipants(uint256 _sessionId) public view returns (address[] memory) {
        return sessions[_sessionId].participants;
    }

    /**
     * @dev Returns taunts of a specific session.
     */
    function getTaunts(uint256 _sessionId) public view returns (string[] memory) {
        return sessions[_sessionId].taunts;
    }

    /**
     * @dev Returns session details.
     */
    function getSession(uint256 _sessionId) public view returns (
        uint256 entryFee,
        bool isActive,
        address winner,
        uint256 totalPool,
        uint256 participantCount
    ) {
        Session storage session = sessions[_sessionId];
        return (
            session.entryFee,
            session.isActive,
            session.winner,
            session.totalPool,
            session.participants.length
        );
    }
}
