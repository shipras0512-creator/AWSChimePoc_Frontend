// HostPage.js
import React, { useState, useRef } from "react";
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
} from "amazon-chime-sdk-js";

const backendUrl = "https://chimepoc-h5gmdmhndmbvd9h6.centralindia-01.azurewebsites.net";

function HostPage() {
  const [meeting, setMeeting] = useState(null);
  const [attendee, setAttendee] = useState(null);
  const [joinUrl, setJoinUrl] = useState("");
  const [meetingSession, setMeetingSession] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [participants, setParticipants] = useState([]);

  const audioRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

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

          if (tile.localTile && localVideoRef.current) {
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

  return (
    <div style={{ padding: 20 }}>
      <h2>AWS Chime Host Page</h2>
      <button onClick={createMeeting}>Start Meeting (Host)</button>
      {meetingSession && <button onClick={endMeeting} style={{ marginLeft: 10, background: "#9f0a0aff", color: "#fff" }} disabled={!meetingSession}>End Meeting</button>}

      {meeting && meeting.MeetingId && (
        <>
        <div style={{ marginTop: 10 }}>
            <strong>Meeting Id:</strong>{" "}
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
        <div style={{ marginTop: 10 }}>
            <strong>Meeting object:</strong>{" "}
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
        </>
        )}

        <h3>👥 Participants</h3>
          <ul>
            {participants.length === 0 ? (
              <li style={{ color: "#666" }}>No attendees yet</li>
            ) : participants.map(p => (
              <li key={p.attendeeId}>{p.externalUserId || p.attendeeId}</li>
            ))}
          </ul>



        <div style={{ marginTop: 20 }}>
          <h3>🔊 Audio / 🎥 Video</h3>
          <audio ref={audioRef} autoPlay />
          <div style={{ display: "flex", gap: 20 }}>
            <div>
              <h4>Local</h4>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ width: 300, border: "1px solid #ccc" }}
              />
            </div>
            <div>
              <h4>Remote</h4>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{ width: 300, border: "1px solid #ccc" }}
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
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

    </div>
  );
}

export default HostPage;

 