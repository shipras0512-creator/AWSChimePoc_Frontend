// src/pages/JoinPage.js
import React, { useState, useRef } from "react";
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  MeetingSessionConfiguration,
  LogLevel,
} from "amazon-chime-sdk-js";
import { useNavigate } from "react-router-dom";
 
const backendUrl = "https://chimepoc-h5gmdmhndmbvd9h6.centralindia-01.azurewebsites.net"; // your backend server
 
function JoinPage() {
  const [meetingId, setMeetingId] = useState("");
  const [meetingObj, setMeetingObj] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [meetingSession, setMeetingSession] = useState(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
 
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const audioRef = useRef(null);
  const screenShareRef = useRef(null);

  const navigate = useNavigate();
 
  const joinMeeting = async () => {
    if (!meetingId || !name) {
      setStatus("⚠️ Please enter meeting ID and name");
      return;
    }
 
    try {
      // Ask backend to create an attendee for this meeting
      const res = await fetch(`${backendUrl}/joinMeeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, name }),
      });
 
      const data = await res.json();
      if (!data.meeting || !data.attendee) {
        setStatus("❌ Failed to get meeting data");
        return;
      }
 
      // Create Chime session
      const logger = new ConsoleLogger("ChimeLogs", LogLevel.INFO);
      const deviceController = new DefaultDeviceController(logger);
      const config = new MeetingSessionConfiguration(data.meeting, data.attendee);
      const session = new DefaultMeetingSession(config, logger, deviceController);
 
      // Bind audio
      session.audioVideo.bindAudioElement(audioRef.current);
 
      // Pick first available devices
      const audioInputs = await session.audioVideo.listAudioInputDevices();
      const audioOutputs = await session.audioVideo.listAudioOutputDevices();
      const videoInputs = await session.audioVideo.listVideoInputDevices();
 
      if (audioInputs.length > 0) {
        await session.audioVideo.startAudioInput(audioInputs[0].deviceId);
      }
      if (audioOutputs.length > 0) {
        await session.audioVideo.chooseAudioOutput(audioOutputs[0].deviceId);
      }
      if (videoInputs.length > 0) {
        await session.audioVideo.startVideoInput(videoInputs[0].deviceId);
        session.audioVideo.startLocalVideoTile();
      }
 
      // Observer for video
      const observer = {
        videoTileDidUpdate: (tile) => {
          if (!tile.boundAttendeeId || !tile.tileId) return;
          if (tile.isContent && screenShareRef.current) {
            // screen share stream
            session.audioVideo.bindVideoElement(tile.tileId, screenShareRef.current);
          }else if (tile.localTile && localVideoRef.current) {
            session.audioVideo.bindVideoElement(tile.tileId, localVideoRef.current);
          } else if (!tile.localTile && remoteVideoRef.current) {
            session.audioVideo.bindVideoElement(tile.tileId, remoteVideoRef.current);
          }
        },
        videoTileWasRemoved: (tileId) => {
          console.log("Tile removed:", tileId);
        },
      };
 
      session.audioVideo.addObserver(observer);
      session.audioVideo.start();
 
      setMeetingSession(session);
      setStatus(`✅ Joined meeting ${meetingId} as ${name}`);
    } catch (err) {
      console.error("Join error:", err);
      setStatus("❌ Failed to join meeting");
    }
  };
 
  const leaveMeeting = () => {
    if (!meetingSession) return;
    try {
      meetingSession.audioVideo.stopLocalVideoTile();
      meetingSession.audioVideo.stopVideoInput();
      meetingSession.audioVideo.stopAudioInput();
      meetingSession.audioVideo.stop();
      setMeetingSession(null);
      setStatus("👋 Left the meeting");
    } catch (err) {
      console.error("Error leaving meeting:", err);
    }
  };
 
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      meetingSession.audioVideo.startContentShare(stream);
      console.log("✅ Screen sharing started (attendee)");
    } catch (err) {
      console.error("❌ Error starting screen share:", err);
    }
  };

  const stopScreenShare = () => {
    try {
      meetingSession.audioVideo.stopContentShare();
      console.log("🛑 Screen sharing stopped (attendee)");
    } catch (err) {
      console.error("❌ Error stopping screen share:", err);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Join Meeting</h2>
      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => navigate("/")}>Create Meeting (Host)</button>
      </div>
      {!meetingSession && (
        <div style={{ marginBottom: "15px" }}>
          {/* <input
            type="text"
            placeholder="Meeting Object"
            value={meetingObj}
            onChange={(e) => setMeetingObj(e.target.value)}
            style={{ marginRight: "10px" }}
          /> */}
          <input
            type="text"
            placeholder="Meeting ID"
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
            style={{ marginRight: "10px" }}
          />
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginRight: "10px" }}
          />
          <button onClick={joinMeeting}>Join</button>
        </div>
      )}
      {meetingSession && (
        <div style={{ marginTop: 20 }}>
          <button onClick={startScreenShare} style={{ marginLeft: 10 }}>
            Start Screen Share
          </button>
          <button onClick={stopScreenShare} style={{ marginLeft: 10 }}>
            Stop Screen Share
          </button>
        </div>
      )}
      <div style={{ display: "flex", gap: 20 }}>
        <div>
          <h4>Local Video</h4>
          <video
            ref={localVideoRef}
            style={{ width: "300px", border: "1px solid #ccc" }}
            autoPlay
            muted
            playsInline
          />
        </div>
        <div>
          <h4>Remote Video</h4>
          <video
            ref={remoteVideoRef}
            style={{ width: "300px", border: "1px solid #ccc" }}
            autoPlay
            playsInline
          />
        </div>
        <div>
          <h4>Screen Share</h4>
          <video
            ref={screenShareRef}
            style={{ width: "300px",height: "300", border: "1px solid #ccc" }}
            autoPlay
            playsInline
          />
        </div>
      </div>
 
      <audio ref={audioRef} autoPlay />
 
      {meetingSession && (
        <div style={{ marginTop: 20 }}>
          <button onClick={leaveMeeting}>Leave Meeting</button>
        </div>
      )}
    </div>
  );
}
 
export default JoinPage;
