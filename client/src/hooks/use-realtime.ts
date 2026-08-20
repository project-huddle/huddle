import { useCallback, useEffect, useRef, useState } from "react"

import { api, type ChatMessage, type MessageMedia, type User, websocketUrl } from "@/lib/api"

type Peer = {
  user: User
  audioStream: MediaStream | null
  cameraStream: MediaStream | null
  screenStream: MediaStream | null
  sharing: boolean
}
type SocketEvent = Record<string, unknown> & { type: string }

const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined
const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined
const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    ...(turnUrl ? [{ urls: turnUrl, username: turnUsername, credential: turnCredential }] : []),
  ],
}

function mediaErrorMessage(cause: unknown, action: "microphone" | "screen") {
  if (!window.isSecureContext || !navigator.mediaDevices) {
    return "Microfone e compartilhamento de tela exigem HTTPS (ou localhost)."
  }
  const name = cause instanceof DOMException ? cause.name : ""
  if (name === "NotAllowedError") return action === "microphone"
    ? "O acesso ao microfone foi negado. Libere a permissão do site no navegador."
    : "O compartilhamento de tela foi cancelado ou bloqueado pelo navegador."
  if (name === "NotFoundError") return action === "microphone"
    ? "Nenhum microfone foi encontrado."
    : "Nenhuma fonte de tela está disponível para compartilhar."
  if (name === "NotReadableError") return action === "microphone"
    ? "O microfone está sendo usado por outro aplicativo."
    : "O navegador não conseguiu capturar a tela selecionada."
  return action === "microphone"
    ? "Não foi possível acessar o microfone."
    : "Não foi possível compartilhar a tela."
}

export function useRealtime(token: string, channelId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [joining, setJoining] = useState(false)
  const [inCall, setInCall] = useState(false)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null)
  const [localDisplayStream, setLocalDisplayStream] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Peer[]>([])
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const connections = useRef(new Map<string, RTCPeerConnection>())
  const pendingCandidates = useRef(new Map<string, RTCIceCandidateInit[]>())
  const peerUsers = useRef(new Map<string, User>())
  const localStream = useRef<MediaStream | null>(null)
  const displayStream = useRef<MediaStream | null>(null)
  const displaySenders = useRef(new Map<string, RTCRtpSender>())
  const videoAssigned = useRef(new Set<string>())

  const send = useCallback((event: object) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return false
    socketRef.current.send(JSON.stringify(event))
    return true
  }, [])

  const updatePeer = useCallback((userId: string, changes: Partial<Peer>) => {
    const user = peerUsers.current.get(userId)
    if (!user) return
    setPeers((items) => {
      const found = items.some((item) => item.user.id === userId)
      return found
        ? items.map((item) => item.user.id === userId ? { ...item, ...changes } : item)
        : [...items, { user, audioStream: null, cameraStream: null, screenStream: null, sharing: false, ...changes }]
    })
  }, [])

  const flushCandidates = useCallback(async (userId: string, pc: RTCPeerConnection) => {
    const candidates = pendingCandidates.current.get(userId) ?? []
    pendingCandidates.current.delete(userId)
    for (const candidate of candidates) await pc.addIceCandidate(candidate)
  }, [])

  const createPeer = useCallback((userId: string) => {
    connections.current.get(userId)?.close()
    const pc = new RTCPeerConnection(rtcConfig)
    connections.current.set(userId, pc)
    localStream.current?.getAudioTracks().forEach((track) => pc.addTrack(track, localStream.current!))
    localStream.current?.getVideoTracks().forEach((track) => pc.addTrack(track, localStream.current!))
    displayStream.current?.getVideoTracks().forEach((track) => {
      displaySenders.current.set(userId, pc.addTrack(track, displayStream.current!))
    })
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) send({ type: "ice_candidate", targetUserId: userId, candidate: candidate.toJSON() })
    }
    pc.ontrack = ({ track, streams }) => {
      const stream = streams[0] ?? new MediaStream([track])
      if (track.kind === "audio") updatePeer(userId, { audioStream: stream })
      if (track.kind === "video") {
        if (!videoAssigned.current.has(userId)) { videoAssigned.current.add(userId); updatePeer(userId, { cameraStream: stream }) }
        else updatePeer(userId, { screenStream: stream, sharing: true })
      }
      track.onended = () => {
        if (track.kind === "audio") updatePeer(userId, { audioStream: null })
        if (track.kind === "video") updatePeer(userId, { cameraStream: null, screenStream: null, sharing: false })
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") setError("A conexão de mídia falhou. Verifique a rede ou configure um servidor TURN.")
      if (["failed", "closed"].includes(pc.connectionState)) {
        updatePeer(userId, { audioStream: null, cameraStream: null, screenStream: null, sharing: false })
      }
    }
    return pc
  }, [send, updatePeer])

  const makeOffer = useCallback(async (userId: string, pc: RTCPeerConnection) => {
    await pc.setLocalDescription(await pc.createOffer())
    send({ type: "webrtc_offer", targetUserId: userId, sdp: pc.localDescription })
  }, [send])

  const closeCall = useCallback((notifyServer: boolean) => {
    if (notifyServer) send({ type: "leave_call" })
    connections.current.forEach((pc) => pc.close())
    connections.current.clear()
    pendingCandidates.current.clear()
    peerUsers.current.clear()
    localStream.current?.getTracks().forEach((track) => track.stop())
    localStream.current = null
    displayStream.current?.getTracks().forEach((track) => track.stop())
    displayStream.current = null
    displaySenders.current.clear()
    setLocalMediaStream(null)
    setLocalDisplayStream(null)
    setPeers([])
    setJoining(false)
    setInCall(false)
    setSharing(false)
    setMuted(false)
    setCameraOff(false)
    videoAssigned.current.clear()
  }, [send])

  useEffect(() => {
    if (!channelId) return
    let alive = true
    api<{ messages: ChatMessage[] }>(`/messages?channelId=${encodeURIComponent(channelId)}&limit=100`, {}, token)
      .then(({ messages }) => alive && setMessages(messages))
      .catch((cause: unknown) => alive && setError(cause instanceof Error ? cause.message : "Não foi possível carregar as mensagens."))

    const socket = new WebSocket(websocketUrl(token))
    socketRef.current = socket
    socket.onopen = () => setConnected(true)
    socket.onclose = () => {
      setConnected(false)
      closeCall(false)
    }
    socket.onerror = () => setError("A conexão em tempo real foi interrompida.")
    socket.onmessage = async ({ data }) => {
      try {
        const event = JSON.parse(String(data)) as SocketEvent
        if (event.type === "chat_message") {
          const message = event.message as ChatMessage
          setMessages((items) => items.some(({ id }) => id === message.id) ? items : [...items, message])
        }
        if (["edit_message", "delete_message", "react_message"].includes(event.type)) {
          const message = event.message as ChatMessage
          setMessages((items) => items.map((item) => item.id === message.id ? message : item))
        }
        if (event.type === "call_joined") {
          const users = event.peers as User[]
          users.forEach((user) => peerUsers.current.set(user.id, user))
          setPeers(users.map((user) => ({ user, audioStream: null, cameraStream: null, screenStream: null, sharing: false })))
          setJoining(false)
          setInCall(true)
          for (const user of users) {
            const pc = createPeer(user.id)
            if (displayStream.current) send({ type: "screen_share", targetUserId: user.id, active: true })
            await makeOffer(user.id, pc)
          }
        }
        if (event.type === "peer_joined") {
          const user = event.user as User
          peerUsers.current.set(user.id, user)
          updatePeer(user.id, {})
        }
        if (event.type === "webrtc_offer") {
          const userId = event.fromUserId as string
          const pc = connections.current.get(userId) ?? createPeer(userId)
          if (displayStream.current) send({ type: "screen_share", targetUserId: userId, active: true })
          await pc.setRemoteDescription(event.sdp as RTCSessionDescriptionInit)
          await flushCandidates(userId, pc)
          await pc.setLocalDescription(await pc.createAnswer())
          send({ type: "webrtc_answer", targetUserId: userId, sdp: pc.localDescription })
        }
        if (event.type === "webrtc_answer") {
          const userId = event.fromUserId as string
          const pc = connections.current.get(userId)
          if (pc) {
            await pc.setRemoteDescription(event.sdp as RTCSessionDescriptionInit)
            await flushCandidates(userId, pc)
          }
        }
        if (event.type === "ice_candidate") {
          const userId = event.fromUserId as string
          const pc = connections.current.get(userId)
          const candidate = event.candidate as RTCIceCandidateInit
          if (pc?.remoteDescription) await pc.addIceCandidate(candidate)
          else pendingCandidates.current.set(userId, [...(pendingCandidates.current.get(userId) ?? []), candidate])
        }
        if (event.type === "screen_share") updatePeer(event.fromUserId as string, { sharing: event.active === true })
        if (event.type === "peer_left") {
          const userId = event.userId as string
          connections.current.get(userId)?.close()
          connections.current.delete(userId)
          videoAssigned.current.delete(userId)
          pendingCandidates.current.delete(userId)
          peerUsers.current.delete(userId)
          setPeers((items) => items.filter((item) => item.user.id !== userId))
        }
        if (event.type === "error") {
          setJoining(false)
          setError(String(event.message ?? "Erro de comunicação."))
        }
      } catch (cause) {
        console.error("Realtime event failed", cause)
        setError("Falha ao processar um evento da chamada.")
      }
    }
    const subscribe = () => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: "subscribe_channel", channelId }))
    socket.addEventListener("open", subscribe)
    return () => {
      alive = false
      socket.close()
      closeCall(false)
    }
  }, [channelId, closeCall, createPeer, flushCandidates, makeOffer, send, token, updatePeer])

  const joinCall = async () => {
    if (joining || inCall) return
    setError(null)
    setJoining(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("Media devices unavailable", "NotSupportedError")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" },
      })
      localStream.current = stream
      setLocalMediaStream(stream)
      if (!send({ type: "join_call", callId: `channel-${channelId}` })) {
        stream.getTracks().forEach((track) => track.stop())
        localStream.current = null
        setLocalMediaStream(null)
        throw new Error("WebSocket is not connected")
      }
    } catch (cause) {
      setJoining(false)
      setError(mediaErrorMessage(cause, "microphone"))
    }
  }

  const leaveCall = () => closeCall(true)

  const toggleMute = () => {
    const next = !muted
    localStream.current?.getAudioTracks().forEach((track) => { track.enabled = !next })
    setMuted(next)
  }

  const toggleCamera = () => {
    const next = !cameraOff
    localStream.current?.getVideoTracks().forEach((track) => { track.enabled = !next })
    setCameraOff(next)
  }

  const stopSharing = useCallback(async () => {
    const stream = displayStream.current
    displayStream.current = null
    if (!stream) return
    stream.getTracks().forEach((track) => { track.onended = null; track.stop() })
    for (const [userId, pc] of connections.current) {
      const sender = displaySenders.current.get(userId)
      if (sender) pc.removeTrack(sender)
      displaySenders.current.delete(userId)
      send({ type: "screen_share", targetUserId: userId, active: false })
      await makeOffer(userId, pc).catch(() => setError("Não foi possível atualizar o compartilhamento de tela."))
    }
    setSharing(false)
    setLocalDisplayStream(null)
  }, [makeOffer, send])

  const toggleShare = async () => {
    if (sharing) return stopSharing()
    setError(null)
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) throw new DOMException("Display media unavailable", "NotSupportedError")
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      displayStream.current = stream
      setLocalDisplayStream(stream)
      const track = stream.getVideoTracks()[0]
      if (!track) throw new DOMException("No display track", "NotFoundError")
      track.onended = () => { void stopSharing() }
      for (const [userId, pc] of connections.current) {
        displaySenders.current.set(userId, pc.addTrack(track, stream))
        send({ type: "screen_share", targetUserId: userId, active: true })
        await makeOffer(userId, pc)
      }
      setSharing(true)
    } catch (cause) {
      displayStream.current?.getTracks().forEach((track) => track.stop())
      displayStream.current = null
      setLocalDisplayStream(null)
      setSharing(false)
      setError(mediaErrorMessage(cause, "screen"))
    }
  }

  return {
    messages, connected, joining, inCall, muted, cameraOff, sharing, peers, error, setError,
    localMediaStream, localDisplayStream,
    sendMessage: (content: string, media: MessageMedia | null = null, replyToId: string | null = null) => send({ type: "chat_message", channelId, content, media, replyToId }),
    editMessage: (messageId: string, content: string) => send({ type: "edit_message", messageId, content }),
    deleteMessage: (messageId: string) => send({ type: "delete_message", messageId }),
    reactMessage: (messageId: string, emoji: string) => send({ type: "react_message", messageId, emoji }),
    joinCall, leaveCall, toggleMute, toggleCamera, toggleShare,
  }
}
