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

const backendUrl =
  "https://chimepoc-h5gmdmhndmbvd9h6.centralindia-01.azurewebsites.net"; // your backend server

function JoinPage() {
  const [meetingId, setMeetingId] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [meetingSession, setMeetingSession] = useState(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [remoteTiles, setRemoteTiles] = useState({});

  const localVideoRef = useRef(null);
  const audioRef = useRef(null);
  const screenShareRef = useRef(null);

  const navigate = useNavigate();

  const joinMeeting = async () => {
    if (!meetingId || !name) {
      setStatus("⚠️ Please enter meeting ID and name");
      return;
    }

    try {
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

      const logger = new ConsoleLogger("ChimeLogs", LogLevel.INFO);
      const deviceController = new DefaultDeviceController(logger);
      const config = new MeetingSessionConfiguration(
        data.meeting,
        data.attendee
      );
      const session = new DefaultMeetingSession(
        config,
        logger,
        deviceController
      );

      session.audioVideo.bindAudioElement(audioRef.current);

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

      const observer = {
        videoTileDidUpdate: (tile) => {
          if (!tile.boundAttendeeId || !tile.tileId) return;

          if (tile.isContent && screenShareRef.current) {
            session.audioVideo.bindVideoElement(
              tile.tileId,
              screenShareRef.current
            );
          } else if (tile.localTile && localVideoRef.current) {
            session.audioVideo.bindVideoElement(
              tile.tileId,
              localVideoRef.current
            );
          } else if (!tile.localTile) {
            setRemoteTiles((prev) => {
              if (!prev[tile.tileId]) {
                return { ...prev, [tile.tileId]: tile.boundAttendeeId };
              }
              return prev;
            });
          }
        },
        videoTileWasRemoved: (tileId) => {
          setRemoteTiles((prev) => {
            const copy = { ...prev };
            delete copy[tileId];
            return copy;
          });
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
      setRemoteTiles({});
      setStatus("👋 Left the meeting");
    } catch (err) {
      console.error("Error leaving meeting:", err);
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      meetingSession.audioVideo.startContentShare(stream);
      setIsSharingScreen(true);
      console.log("✅ Screen sharing started (attendee)");
    } catch (err) {
      console.error("❌ Error starting screen share:", err);
    }
  };

  const stopScreenShare = () => {
    try {
      meetingSession.audioVideo.stopContentShare();
      setIsSharingScreen(false);
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
          <button onClick={leaveMeeting}
          style={{
                background: "#9f0a0aff",
                color: "#fff",
              }}
          >Leave Meeting</button>
        </div>
      )}
      {status && <p>{status}</p>}

      {meetingSession && (
        <div style={{ marginTop: 20 }}>
          {!isSharingScreen ? (
            <button onClick={startScreenShare}>Start Screen Share</button>
          ) : (
            <button onClick={stopScreenShare}>Stop Screen Share</button>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          marginTop: "20px",
          border: "2px solid #ccc",
          borderRadius: "12px",
          padding: "20px",
          background: "#fff",
          boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
        }}
      >
        {/* Top row: Local + Screen Share */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
        >
          {/* Local */}
          <div>
            <h4 style={{ marginBottom: "10px" }}>Local Video</h4>
            <video
              ref={localVideoRef}
              style={{
                width: "100%",
                height: "250px",
                border: "1px solid #ccc",
                borderRadius: "8px",
                objectFit: "cover",
              }}
              autoPlay
              muted
              playsInline
            />
          </div>

          {/* Screen Share */}
          <div>
            <h4 style={{ marginBottom: "10px" }}>Screen Share</h4>
            <video
              ref={screenShareRef}
              style={{
                width: "100%",
                height: "250px",
                border: "1px solid #ccc",
                borderRadius: "8px",
                objectFit: "contain",
                background: "#000",
              }}
              autoPlay
              playsInline
            />
          </div>
        </div>

        {/* Remote Participants */}
        <div>
          <h4 style={{ marginBottom: "10px" }}>Remote Participants</h4>
          <div
            style={{
              minHeight: "200px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "15px",
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "10px",
            }}
          >
            {Object.keys(remoteTiles).length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  color: "#666",
                  fontStyle: "italic",
                }}
              >
                No remote videos yet
              </div>
            )}
            {Object.keys(remoteTiles).map((tileId) => (
              <div
                key={tileId}
                style={{
                  position: "relative",
                  background: "#000",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                <video
                  ref={(el) => {
                    if (el) {
                      meetingSession?.audioVideo?.bindVideoElement(
                        parseInt(tileId),
                        el
                      );
                    }
                  }}
                  autoPlay
                  playsInline
                  style={{
                    width: "100%",
                    height: "180px",
                    objectFit: "cover",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: "5px",
                    left: "5px",
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    fontSize: "12px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  Attendee {remoteTiles[tileId]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>


      <audio ref={audioRef} autoPlay />
    </div>
  );
}

export default JoinPage;
