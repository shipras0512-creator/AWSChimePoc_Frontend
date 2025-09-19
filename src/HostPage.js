// HostPage.js
import React, { useState, useRef } from "react";
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
} from "amazon-chime-sdk-js";
import { useNavigate } from "react-router-dom";

const backendUrl = "https://chimepoc-h5gmdmhndmbvd9h6.centralindia-01.azurewebsites.net";

function HostPage() {
  const [meeting, setMeeting] = useState(null);
  const [attendee, setAttendee] = useState(null);
  const [joinUrl, setJoinUrl] = useState("");
  const [meetingSession, setMeetingSession] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [status, setStatus] = useState("");
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [remoteTiles, setRemoteTiles] = useState({});

  const audioRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenShareRef = useRef(null);

  const navigate = useNavigate();

  const createMeeting = async () => {
    try {
      const res = await fetch(`${backendUrl}/createMeeting`, { method: "POST" });
      const data = await res.json();

      setMeeting(data.meeting);
      setAttendee(data.attendee);
      setJoinUrl(data.joinUrl);

      alert(`✅ Meeting created!`);

      // Auto-join host immediately
      await joinMeeting(data.meeting, data.attendee);
    } catch (err) {
      console.error("Error creating meeting:", err);
      alert("Failed to create meeting. See console.");
    }
  };

  const joinMeeting = async (meetingData = meeting, attendeeData = attendee) => {
    if (!meetingData || !attendeeData) {
      alert("Meeting or attendee data missing");
      return;
    }

    try {
      const logger = new ConsoleLogger("ChimeLogs", LogLevel.INFO);
      const deviceController = new DefaultDeviceController(logger);
      const config = new MeetingSessionConfiguration(meetingData, attendeeData);
      const session = new DefaultMeetingSession(config, logger, deviceController);

      // Bind audio
      if (audioRef.current) {
        session.audioVideo.bindAudioElement(audioRef.current);
      }

      // List devices
      const audioIn = await session.audioVideo.listAudioInputDevices();
      const audioOut = await session.audioVideo.listAudioOutputDevices();
      const videoIn = await session.audioVideo.listVideoInputDevices();

      if (audioIn[0]) await session.audioVideo.startAudioInput(audioIn[0].deviceId);
      if (audioOut[0]) await session.audioVideo.chooseAudioOutput(audioOut[0].deviceId);
      if (videoIn[0]) await session.audioVideo.startVideoInput(videoIn[0].deviceId);

      // Observer for video tiles
     const observer = {
      videoTileDidUpdate: (tile) => {
        if (!tile.boundAttendeeId || !tile.tileId) return;

        if (tile.isContent) {
          if (screenShareRef.current) {
            session.audioVideo.bindVideoElement(tile.tileId, screenShareRef.current);
          }
        } else if (tile.localTile && localVideoRef.current) {
          session.audioVideo.bindVideoElement(tile.tileId, localVideoRef.current);
        } else if (!tile.localTile) {
          setRemoteTiles(prev => {
            if (!prev[tile.tileId]) {
              return { ...prev, [tile.tileId]: tile.boundAttendeeId };
            }
            return prev;
          });
        }
      },
      videoTileWasRemoved: (tileId) => {
        console.log("Tile removed:", tileId);
        setRemoteTiles(prev => {
          const copy = { ...prev };
          delete copy[tileId];
          return copy;
        });
      },
    };


      session.audioVideo.addObserver(observer);

      session.audioVideo.realtimeSubscribeToAttendeeIdPresence((attendeeId, present, externalUserId) => {
        setParticipants(prev => {
          if (present) {
            if (!prev.find(p => p.attendeeId === attendeeId)) {
              return [...prev, { attendeeId, externalUserId }];
            }
            return prev;
          } else {
            return prev.filter(p => p.attendeeId !== attendeeId);
          }
        });
      });

      session.audioVideo.start();
      session.audioVideo.startLocalVideoTile();

      setMeetingSession(session);
      alert("✅ Host joined the meeting!");
    } catch (err) {
      console.error("Start meeting error:", err);
      alert("Failed to start meeting. See console.");
    }
  };

  const startTranscription = async () => {
    if (!meeting) return;
    try {
      const res = await fetch(`${backendUrl}/startTranscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.MeetingId }),
      });
      const data = await res.json();
      alert("📝 Transcription started (backend)");
      console.log(data);
    } catch (err) {
      console.error("Error starting transcription:", err);
    }
  };

  const stopTranscription = async () => {
    if (!meeting) return;
    try {
      const res = await fetch(`${backendUrl}/stopTranscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.MeetingId }),
      });
      const data = await res.json();
      alert("🛑 Transcription stopped (backend)");
      console.log(data);
    } catch (err) {
      console.error("Error stopping transcription:", err);
    }
  };

  const endMeeting = async () => {
    if (!meetingSession) return;

    try {
      await fetch(`${backendUrl}/endMeeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.MeetingId }),
      });
    } catch (err) {
      console.error("Error ending meeting:", err);
    }

    try {
      meetingSession.audioVideo.stopLocalVideoTile();
      meetingSession.audioVideo.stopVideoInput();
      meetingSession.audioVideo.stopAudioInput();
      meetingSession.audioVideo.stop();
    } catch (e) {
      console.warn("Error cleaning up audio/video", e);
    }

    setMeetingSession(null);
    setTranscripts([]);
    setMeeting(null);
    setAttendee(null);
    setJoinUrl("");
    setParticipants([]);
    alert("👋 Meeting ended and cleaned up");
  };

    const startScreenShare = async () => {
    try {
      await meetingSession.audioVideo.startContentShareFromScreenCapture();
      setIsSharingScreen(true);
      setStatus("🖥️ Sharing screen...");
    } catch (err) {
      console.error("Error starting screen share:", err);
      setStatus("❌ Failed to start screen share");
    }
  };

  const stopScreenShare = () => {
    try {
      meetingSession.audioVideo.stopContentShare();
      setIsSharingScreen(false);
      setStatus("🛑 Stopped screen sharing");
    } catch (err) {
      console.error("Error stopping screen share:", err);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>AWS Chime POC</h2>

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        {/* LEFT PANEL */}
        <div
          style={{
            flex: "0 0 250px",
            display: "flex",
            flexDirection: "column",
            gap: "15px",
          }}
        >
          <button onClick={() => navigate("/join")}>Join Meeting</button>
          <button onClick={createMeeting}>Start Meeting (Host)</button>
          {meetingSession && (
            <button
              onClick={endMeeting}
              style={{
                background: "#9f0a0aff",
                color: "#fff",
              }}
              disabled={!meetingSession}
            >
              End Meeting
            </button>
          )}

          {meeting && meeting.MeetingId && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <strong>Meeting Id:</strong>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(meeting.MeetingId);
                    alert("Meeting ID copied to clipboard!");
                  }}
                  style={{
                    marginLeft: 10,
                    padding: "4px 10px",
                    cursor: "pointer",
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    background: "#f5f5f5",
                  }}
                >
                  Copy Meeting ID
                </button>
              </div>

              <div>
                <strong>Meeting object:</strong>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(meeting));
                    alert("Meeting Object copied to clipboard!");
                  }}
                  style={{
                    marginLeft: 10,
                    padding: "4px 10px",
                    cursor: "pointer",
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    background: "#f5f5f5",
                  }}
                >
                  Copy Meeting Object
                </button>
              </div>
            </div>
          )}

          <div>
            <h3>👥 Participants</h3>
            <ul style={{ margin: 0, paddingLeft: "20px" }}>
              {participants.length === 0 ? (
                <li style={{ color: "#666" }}>No attendees yet</li>
              ) : (
                participants.map((p) => (
                  <li key={p.attendeeId}>{p.externalUserId || p.attendeeId}</li>
                ))
              )}
            </ul>
          </div>

          <div>
            {!isSharingScreen ? (
              <button onClick={startScreenShare}>Start Screen Share</button>
            ) : (
              <button onClick={stopScreenShare}>Stop Screen Share</button>
            )}
          </div>

          <div>
            <h4>Local</h4>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "8px",
              }}
            />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div
          style={{
            flex: 1,
            border: "2px solid #ccc",
            borderRadius: "12px",
            padding: "15px",
            background: "#fff",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <audio ref={audioRef} autoPlay />

          {/* REMOTE */}
          <div>
            <h4>Remote Participants</h4>
            <div
              style={{
                minHeight: "300px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "10px",
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
                      height: "200px",
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

          {/* SCREEN SHARE */}
          <div>
            <h4>Screen Share</h4>
            <video
              ref={screenShareRef}
              style={{
                width: "100%",
                minHeight: "300px",
                border: "1px solid #ccc",
                borderRadius: "8px",
              }}
              autoPlay
              playsInline
            />
          </div>
        </div>
      </div>

      {/* TRANSCRIPTION */}
      <div style={{ marginTop: 20 }}>
        <button onClick={startTranscription}>Start Transcription</button>
        <button onClick={stopTranscription} style={{ marginLeft: 10 }}>
          Stop Transcription
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>📝 Live Transcript</h3>
        <div
          style={{
            maxHeight: 200,
            overflowY: "auto",
            border: "1px solid #ccc",
            padding: 10,
            borderRadius: "8px",
            background: "#fafafa",
          }}
        >
          {transcripts.length === 0 ? (
            <div style={{ color: "#666" }}>No transcripts yet</div>
          ) : (
            transcripts.map((t, i) => <div key={i}>{t}</div>)
          )}
        </div>
      </div>
    </div>

  );
}

export default HostPage;
