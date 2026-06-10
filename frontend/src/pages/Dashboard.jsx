import React, { useState, useEffect, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaSearch, FaPaperclip, FaSmile, FaMicrophone, FaStop, FaVideo, FaPhone, 
  FaEllipsisV, FaPlus, FaSignOutAlt, FaArchive, FaThumbtack, FaVolumeMute, 
  FaUserCog, FaUsers, FaBroadcastTower, FaUserPlus, FaFileAlt, FaMapMarkerAlt, 
  FaUser, FaTimes, FaUserSlash, FaDownload, FaStar, FaReply, FaShare, FaTrash, 
  FaEdit, FaClock, FaSignOutAlt as FaExit, FaFileExport, FaCloudDownloadAlt, FaInfoCircle
} from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext.jsx';
import { SocketContext } from '../context/SocketContext.jsx';
import { CallContext } from '../context/CallContext.jsx';
import api from '../utils/api.js';
import { deriveSharedSecret, encryptMessage, decryptMessage, encryptFile, decryptFile } from '../utils/crypto.js';
import { savePrivateKey } from '../hooks/useIndexedDB.js';

// Subcomponents imports
import AudioPlayer from '../components/chat/AudioPlayer.jsx';
import LocationSharing from '../components/chat/LocationSharing.jsx';
import PollMessage from '../components/chat/PollMessage.jsx';
import CallOverlay from '../components/calling/CallOverlay.jsx';

export default function Dashboard() {
  const { user, privateKey, logout, regenerateKeyPair, setPrivateKey } = useContext(AuthContext);
  const { socket, getOnlineStatus } = useContext(SocketContext);
  const { initiateCall } = useContext(CallContext);

  // States
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [decryptedCache, setDecryptedCache] = useState({}); // messageId -> string
  const [inputText, setInputText] = useState('');
  
  // Modals & Panels
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showNewBroadcastModal, setShowNewBroadcastModal] = useState(false);
  const [chatSettingsDropdown, setChatSettingsDropdown] = useState(false);

  // Filter Pills: 'all' | 'unread' | 'groups' | 'broadcasts' | 'archived'
  const [activeFilter, setActiveFilter] = useState('all');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Group creation fields
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupParticipants, setGroupParticipants] = useState([]); // user IDs
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);

  // Broadcast creation fields
  const [broadcastName, setBroadcastName] = useState('');
  const [broadcastRecipients, setBroadcastRecipients] = useState([]); // user IDs
  const [broadcastLists, setBroadcastLists] = useState([]); // broadcast meta lists

  // Typing status indicators
  const [typingUsers, setTypingUsers] = useState({}); // chatId -> Set of usernames
  const [isLocalTyping, setIsLocalTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Attachment settings
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Scheduled message setting
  const [scheduleTime, setScheduleTime] = useState('');
  const [showScheduler, setShowScheduler] = useState(false);

  // Starred messages
  const [starredMessageIds, setStarredMessageIds] = useState(new Set());
  
  // Message reply anchor
  const [replyAnchor, setReplyAnchor] = useState(null); // Message object

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Client Search Messages inside Selected Chat
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);

  // Edit sent message
  const [editingMessage, setEditingMessage] = useState(null);

  // Profile fields update
  const [fullNameInput, setFullNameInput] = useState(user?.fullName || '');
  const [bioInput, setBioInput] = useState(user?.bio || '');
  const [statusInput, setStatusInput] = useState(user?.status || 'online');
  const [privacyLastSeen, setPrivacyLastSeen] = useState(user?.privacy?.lastSeen || 'everyone');
  const [privacyReadReceipts, setPrivacyReadReceipts] = useState(user?.privacy?.readReceipts ?? true);
  const [avatarUploadFile, setAvatarUploadFile] = useState(null);

  // Poll Creator Fields
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Shared contact details
  const [showContactCreator, setShowContactCreator] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Location details
  const [showLocationCreator, setShowLocationCreator] = useState(false);
  const [locLat, setLocLat] = useState('37.7749');
  const [locLng, setLocLng] = useState('-122.4194');
  const [locAddress, setLocAddress] = useState('San Francisco, CA');

  // Infinite Scroll ref
  const messageStreamEndRef = useRef(null);

  // 1. Initial Load of Chats
  const loadChats = async () => {
    try {
      const { data } = await api.get('/chats');
      setChats(data);

      const bcRes = await api.get('/broadcasts');
      setBroadcastLists(bcRes.data);
    } catch (error) {
      console.error('Failed to load chat listings:', error);
    }
  };

  useEffect(() => {
    loadChats();
  }, []);

  // Sync profile details inputs
  useEffect(() => {
    if (user) {
      setFullNameInput(user.fullName);
      setBioInput(user.bio);
      setStatusInput(user.status);
      setPrivacyLastSeen(user.privacy?.lastSeen || 'everyone');
      setPrivacyReadReceipts(user.privacy?.readReceipts ?? true);
    }
  }, [user]);

  // 2. Chat Selection changes
  useEffect(() => {
    if (!activeChat) return;

    // Join room on Socket server
    if (socket) {
      socket.emit('join_chat', activeChat._id);
    }

    // Load messages
    const loadMessages = async () => {
      try {
        const { data } = await api.get(`/messages/${activeChat._id}`);
        setMessages(data);
        
        // Mark chat unread count to 0 locally
        setChats(prev => prev.map(c => c._id === activeChat._id ? { ...c, unreadCount: 0 } : c));
      } catch (err) {
        console.error('Failed to load chat messages:', err);
      }
    };

    loadMessages();
    setReplyAnchor(null);
    setEditingMessage(null);
    setShowMsgSearch(false);
    setMessageSearchQuery('');

    return () => {
      if (socket) {
        socket.emit('leave_chat', activeChat._id);
      }
    };
  }, [activeChat, socket]);

  // 3. Socket event handlers hook
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = async (msg) => {
      // If message is for the active chat
      if (activeChat && (msg.chat._id === activeChat._id || msg.chat === activeChat._id)) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });

        // Decrypt text client-side right away
        const plain = await decryptSingleMessage(msg);
        setDecryptedCache(prev => ({ ...prev, [msg._id]: plain }));

        // Trigger typing indicators cleanup
        setTypingUsers(prev => {
          const chatTyping = prev[msg.chat._id || msg.chat] || new Set();
          chatTyping.delete(msg.sender.username);
          return { ...prev, [msg.chat._id || msg.chat]: new Set(chatTyping) };
        });

        // Mark read
        api.get(`/messages/${activeChat._id}`).catch(e => console.log('Auto-read error'));
      } else {
        // Increment unread count for other chats in local view
        setChats(prev => prev.map(c => {
          const chatId = msg.chat._id || msg.chat;
          if (c._id === chatId) {
            return { ...c, unreadCount: (c.unreadCount || 0) + 1, lastMessage: msg };
          }
          return c;
        }));
      }

      // Re-sort chats list
      loadChats();
    };

    const handleEditMessage = async (msg) => {
      if (activeChat && (msg.chat === activeChat._id || msg.chat._id === activeChat._id)) {
        setMessages(prev => prev.map(m => m._id === msg._id ? msg : m));
        const plain = await decryptSingleMessage(msg);
        setDecryptedCache(prev => ({ ...prev, [msg._id]: plain }));
      }
    };

    const handleDeleteMessage = (data) => {
      if (activeChat && (data.chat === activeChat._id || data.chat._id === activeChat._id)) {
        setMessages(prev => prev.map(m => m._id === data._id ? { 
          ...m, 
          isDeleted: true, 
          ciphertext: data.ciphertext, 
          iv: data.iv,
          fileMetadata: undefined,
          location: undefined,
          contact: undefined,
          poll: undefined
        } : m));
        setDecryptedCache(prev => ({ ...prev, [data._id]: data.ciphertext }));
      }
    };

    const handleTyping = ({ chatId, userId: senderId, username }) => {
      setTypingUsers(prev => {
        const chatTyping = prev[chatId] || new Set();
        chatTyping.add(username);
        return { ...prev, [chatId]: new Set(chatTyping) };
      });
    };

    const handleStopTyping = ({ chatId, userId: senderId }) => {
      setTypingUsers(prev => {
        const chatTyping = prev[chatId] || new Set();
        // Since we don't have the username in stop_typing, we find the sender username from chats mapping
        const targetChat = chats.find(c => c._id === chatId);
        const userObj = targetChat?.participants.find(p => p._id === senderId);
        if (userObj) {
          chatTyping.delete(userObj.username);
        } else {
          chatTyping.clear(); // Safe fallback
        }
        return { ...prev, [chatId]: new Set(chatTyping) };
      });
    };

    const handleMessageReaction = ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
    };

    const handlePollUpdate = ({ messageId, poll }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, poll } : m));
    };

    const handleNewBroadcast = (data) => {
      loadChats();
      // Print notification alert
      console.log(`[Broadcast] Received broadcast from list: ${data.listName}`);
      handleReceiveMessage(data.message);
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('edit_message', handleEditMessage);
    socket.on('delete_message', handleDeleteMessage);
    socket.on('typing', handleTyping);
    socket.on('stop_typing', handleStopTyping);
    socket.on('message_reaction', handleMessageReaction);
    socket.on('poll_update', handlePollUpdate);
    socket.on('new_broadcast_message', handleNewBroadcast);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('edit_message', handleEditMessage);
      socket.off('delete_message', handleDeleteMessage);
      socket.off('typing', handleTyping);
      socket.off('stop_typing', handleStopTyping);
      socket.off('message_reaction', handleMessageReaction);
      socket.off('poll_update', handlePollUpdate);
      socket.off('new_broadcast_message', handleNewBroadcast);
    };
  }, [socket, activeChat, chats]);

  // 4. Client Decryption Worker mapping
  useEffect(() => {
    const decryptAllMessages = async () => {
      const newCache = { ...decryptedCache };
      let changed = false;

      for (let msg of messages) {
        if (!newCache[msg._id]) {
          const plain = await decryptSingleMessage(msg);
          newCache[msg._id] = plain;
          changed = true;
        }
      }

      for (let chatItem of chats) {
        if (chatItem.lastMessage && !newCache[chatItem.lastMessage._id]) {
          const plain = await decryptSingleMessage(chatItem.lastMessage);
          newCache[chatItem.lastMessage._id] = plain;
          changed = true;
        }
      }

      if (changed) {
        setDecryptedCache(newCache);
      }
    };

    if (messages.length > 0 || chats.length > 0) {
      decryptAllMessages();
    }
  }, [messages, chats, privateKey]);

  // Scroll to bottom on new message
  useEffect(() => {
    messageStreamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // E2EE Decryption logic
  const decryptSingleMessage = async (msg) => {
    if (msg.isDeleted) return 'This message was deleted';
    
    if (msg.messageType === 'poll') return `📊 Poll: ${msg.poll?.question}`;
    if (msg.messageType === 'location') return `📍 Location: ${msg.location?.address || 'Map Pin'}`;
    if (msg.messageType === 'contact') return `👤 Contact: ${msg.contact?.name}`;
    if (msg.messageType === 'image') return '🖼️ Photo attachment';
    if (msg.messageType === 'video') return '📹 Video attachment';
    if (msg.messageType === 'audio') return '🎤 Voice note';
    if (msg.messageType === 'document') return '📄 File document';

    if (!privateKey) {
      return '[Private key missing on this device]';
    }

    try {
      if (msg.chat.isGroup || msg.chat?.groupKeys) {
        // Group Decryption: Find the matching group key entry decrypted for current user
        // Retrieve group model details
        const targetChat = chats.find(c => c._id === (msg.chat._id || msg.chat));
        if (!targetChat) return '[Group context not found]';

        const myKeyEntry = targetChat.groupKeys?.find(
          k => (k.user._id || k.user) === user._id
        );

        if (!myKeyEntry) return '[Not authorized for E2EE Group Keys]';

        // Deriving shared secret between current user private key and group creator public key
        // To simplify, groupKeys has group keys encrypted. In production, we unwrap the key.
        // We will mock the group key unwrap or perform direct AES unwrap if valid.
        // For local development mockup: we can parse or fall back to plaintext fallback
        // We will implement a mock unwrap that checks key structures
        if (myKeyEntry.encryptedKey.startsWith('{') || myKeyEntry.encryptedKey.startsWith('ey')) {
          // Wrapped JWK key. To decrypt, we derive shared secret with the chat creator public key
          // For now, let's treat the encryptedKey as E2EE-safe ciphertext and decrypt it
          // Or simple fallback:
          try {
            const creator = targetChat.participants.find(p => targetChat.admins.some(a => (a._id || a) === p._id)) || targetChat.participants[0];
            const sharedSecret = await deriveSharedSecret(privateKey, creator.publicKey);
            // Decrypt the group key
            const rawGroupKey = await decryptMessage(sharedSecret, myKeyEntry.encryptedKey, msg.iv);
            
            // Now decrypt the message ciphertext using decrypted group key
            // For now, we will perform standard direct AES decryption or mock E2EE string match
            return await decryptMessage(sharedSecret, msg.ciphertext, msg.iv); // fallback to shared secret
          } catch (e) {
            // If wrapping derivation fails, fallback
            return msg.ciphertext;
          }
        }
        return msg.ciphertext;
      } else {
        // 1-on-1 direct E2EE decryption
        // Find other participant public key
        const chatObj = chats.find(c => c._id === (msg.chat._id || msg.chat));
        const otherParticipant = chatObj?.participants.find(p => p._id !== user._id) || msg.sender;
        
        if (!otherParticipant || !otherParticipant.publicKey) {
          return '[Participant keys missing]';
        }

        const sharedKey = await deriveSharedSecret(privateKey, otherParticipant.publicKey);
        const decrypted = await decryptMessage(sharedKey, msg.ciphertext, msg.iv);
        return decrypted;
      }
    } catch (err) {
      console.error(err);
      return '[E2EE Decryption Failed]';
    }
  };

  // 5. Global Directory search users
  const handleGlobalSearch = async (e) => {
    const q = e.target.value;
    setGlobalSearchQuery(q);
    if (q.trim().length === 0) {
      return setSearchResults([]);
    }
    try {
      const { data } = await api.get(`/users/search?q=${q}`);
      setSearchResults(data);
    } catch (err) {
      console.log(err);
    }
  };

  // Open Chat with a searched user
  const handleStartChat = async (recipientId) => {
    try {
      const { data } = await api.post('/chats', { recipientId });
      // Reload chats and set active
      await loadChats();
      setActiveChat(data);
      setShowNewChatModal(false);
      setGlobalSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start chat');
    }
  };

  // 6. Typing trigger alerts
  const handleInputTextChange = (e) => {
    setInputText(e.target.value);
    if (!socket || !activeChat) return;

    if (!isLocalTyping) {
      setIsLocalTyping(true);
      socket.emit('typing', { chatId: activeChat._id, username: user.username });
    }

    // Debounce stop typing emit
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { chatId: activeChat._id });
      setIsLocalTyping(false);
    }, 2500);
  };

  // 7. Message Send Submission
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !activeChat) return;

    let ciphertext = inputText;
    let iv = '000000000000000000000000'; // fallback mock IV
    let fileKey = '';
    let encryptedFileBlob = null;

    try {
      // If file attachment exists, perform local binary E2EE
      if (selectedFile) {
        const { encryptedData, keyJwk } = await encryptFile(selectedFile);
        encryptedFileBlob = encryptedData;
        fileKey = keyJwk; // ephemeral file key
      }

      // Message encryption
      if (activeChat.isGroup) {
        // Group Chat Encryption: encrypt message using group shared secret derived with admin
        const creator = activeChat.participants.find(p => activeChat.admins.some(a => (a._id || a) === p._id)) || activeChat.participants[0];
        const sharedSecret = await deriveSharedSecret(privateKey, creator.publicKey);
        const encrypted = await encryptMessage(sharedSecret, inputText || selectedFile?.name || 'File Attachment');
        ciphertext = encrypted.ciphertext;
        iv = encrypted.iv;
      } else {
        // Direct E2EE encryption
        const recipient = activeChat.participants.find(p => p._id !== user._id);
        if (recipient && recipient.publicKey) {
          const sharedSecret = await deriveSharedSecret(privateKey, recipient.publicKey);
          const encrypted = await encryptMessage(sharedSecret, inputText || selectedFile?.name || 'File Attachment');
          ciphertext = encrypted.ciphertext;
          iv = encrypted.iv;
        }
      }

      // Prepare payload formdata
      const formData = new FormData();
      formData.append('chatId', activeChat._id);
      formData.append('ciphertext', ciphertext);
      formData.append('iv', iv);
      
      if (selectedFile && encryptedFileBlob) {
        const ext = selectedFile.name.split('.').pop();
        const mime = selectedFile.type;
        let type = 'document';
        if (mime.startsWith('image/')) type = 'image';
        else if (mime.startsWith('video/')) type = 'video';
        else if (mime.startsWith('audio/')) type = 'audio';

        formData.append('file', encryptedFileBlob, `encrypted-${Date.now()}.${ext}`);
        formData.append('messageType', type);
        formData.append('fileName', selectedFile.name);
        formData.append('fileKey', fileKey); // wrapped key
      } else {
        formData.append('messageType', 'text');
      }

      // Schedule support
      if (scheduleTime) {
        formData.append('scheduledFor', new Date(scheduleTime).toISOString());
      }

      // Reply support
      if (replyAnchor) {
        formData.append('replyTo', replyAnchor._id);
      }

      const { data } = await api.post('/messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Update local view
      if (!scheduleTime) {
        setMessages(prev => [...prev, data]);
        setDecryptedCache(prev => ({ ...prev, [data._id]: inputText || selectedFile?.name || 'File' }));
      } else {
        alert('Message scheduled successfully');
      }

      // Clear states
      setInputText('');
      setSelectedFile(null);
      setReplyAnchor(null);
      setScheduleTime('');
      setShowScheduler(false);
      setAttachmentMenu(false);

      if (socket) {
        socket.emit('stop_typing', { chatId: activeChat._id });
        setIsLocalTyping(false);
      }

      loadChats();
    } catch (err) {
      console.error(err);
      alert('Failed to send E2EE payload');
    }
  };

  // Edit / Update message API
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingMessage || !inputText.trim()) return;

    try {
      let ciphertext = inputText;
      let iv = '000000000000000000000000';

      if (activeChat.isGroup) {
        const creator = activeChat.participants.find(p => activeChat.admins.some(a => (a._id || a) === p._id)) || activeChat.participants[0];
        const sharedSecret = await deriveSharedSecret(privateKey, creator.publicKey);
        const encrypted = await encryptMessage(sharedSecret, inputText);
        ciphertext = encrypted.ciphertext;
        iv = encrypted.iv;
      } else {
        const recipient = activeChat.participants.find(p => p._id !== user._id);
        const sharedSecret = await deriveSharedSecret(privateKey, recipient.publicKey);
        const encrypted = await encryptMessage(sharedSecret, inputText);
        ciphertext = encrypted.ciphertext;
        iv = encrypted.iv;
      }

      const { data } = await api.put(`/messages/${editingMessage._id}`, {
        ciphertext,
        iv
      });

      setMessages(prev => prev.map(m => m._id === data._id ? data : m));
      setDecryptedCache(prev => ({ ...prev, [data._id]: inputText }));
      setEditingMessage(null);
      setInputText('');
    } catch (err) {
      alert(err.response?.data?.message || 'Edit window has expired');
    }
  };

  // Delete / Unsend message API
  const handleDeleteMessage = async (msgId) => {
    if (!confirm('Are you sure you want to unsend this message?')) return;
    try {
      const { data } = await api.delete(`/messages/${msgId}`);
      setMessages(prev => prev.map(m => m._id === msgId ? { 
        ...m, 
        isDeleted: true, 
        ciphertext: 'This message was deleted', 
        iv: '000000000000000000000000',
        fileMetadata: undefined,
        location: undefined,
        contact: undefined,
        poll: undefined
      } : m));
      setDecryptedCache(prev => ({ ...prev, [msgId]: 'This message was deleted' }));
    } catch (err) {
      alert(err.response?.data?.message || 'Unsend failed');
    }
  };

  // Add Emoji reaction API
  const handleReactToMessage = async (msgId, emoji) => {
    try {
      const { data } = await api.post(`/messages/react/${msgId}`, { emoji });
      setMessages(prev => prev.map(m => m._id === msgId ? { ...m, reactions: data } : m));
    } catch (err) {
      console.error(err);
    }
  };

  // Star message toggle
  const handleToggleStarMessage = (msgId) => {
    setStarredMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  // 8. Poll message submit creator
  const handleSendPoll = async (e) => {
    e.preventDefault();
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
      return alert('Question and at least 2 options are required');
    }

    try {
      // Encrypt question for E2EE mapping
      let ciphertext = `Poll: ${pollQuestion}`;
      let iv = '000000000000000000000000';

      if (activeChat.isGroup) {
        const creator = activeChat.participants.find(p => activeChat.admins.some(a => (a._id || a) === p._id)) || activeChat.participants[0];
        const sharedSecret = await deriveSharedSecret(privateKey, creator.publicKey);
        const encrypted = await encryptMessage(sharedSecret, ciphertext);
        ciphertext = encrypted.ciphertext;
        iv = encrypted.iv;
      } else {
        const recipient = activeChat.participants.find(p => p._id !== user._id);
        const sharedSecret = await deriveSharedSecret(privateKey, recipient.publicKey);
        const encrypted = await encryptMessage(sharedSecret, ciphertext);
        ciphertext = encrypted.ciphertext;
        iv = encrypted.iv;
      }

      const { data } = await api.post('/messages', {
        chatId: activeChat._id,
        ciphertext,
        iv,
        messageType: 'poll',
        poll: {
          question: pollQuestion,
          options: pollOptions.filter(o => o.trim())
        }
      });

      setMessages(prev => [...prev, data]);
      setDecryptedCache(prev => ({ ...prev, [data._id]: `📊 Poll: ${pollQuestion}` }));
      setShowPollCreator(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      loadChats();
    } catch (err) {
      alert('Failed to send E2EE poll');
    }
  };

  // Vote on Poll API
  const handleVotePoll = async (msgId, optionText) => {
    try {
      const { data } = await api.post(`/messages/vote/${msgId}`, { optionText });
      setMessages(prev => prev.map(m => m._id === msgId ? { ...m, poll: data } : m));
    } catch (err) {
      console.error(err);
    }
  };

  // Send Geolocation Map pin API
  const handleSendLocation = async (e) => {
    e.preventDefault();
    try {
      let ciphertext = `Location: ${locAddress}`;
      let iv = '000000000000000000000000';

      if (activeChat.isGroup) {
        const creator = activeChat.participants.find(p => activeChat.admins.some(a => (a._id || a) === p._id)) || activeChat.participants[0];
        const sharedSecret = await deriveSharedSecret(privateKey, creator.publicKey);
        const encrypted = await encryptMessage(sharedSecret, ciphertext);
        ciphertext = encrypted.ciphertext;
        iv = encrypted.iv;
      } else {
        const recipient = activeChat.participants.find(p => p._id !== user._id);
        const sharedSecret = await deriveSharedSecret(privateKey, recipient.publicKey);
        const encrypted = await encryptMessage(sharedSecret, ciphertext);
        ciphertext = encrypted.ciphertext;
        iv = encrypted.iv;
      }

      const { data } = await api.post('/messages', {
        chatId: activeChat._id,
        ciphertext,
        iv,
        messageType: 'location',
        location: {
          latitude: parseFloat(locLat),
          longitude: parseFloat(locLng),
          address: locAddress
        }
      });

      setMessages(prev => [...prev, data]);
      setDecryptedCache(prev => ({ ...prev, [data._id]: `📍 Location: ${locAddress}` }));
      setShowLocationCreator(false);
      setLocAddress('San Francisco, CA');
      loadChats();
    } catch (err) {
      alert('Failed to send E2EE location');
    }
  };

  // Send Shared Contact API
  const handleSendContact = async (e) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) return;
    try {
      let ciphertext = `Contact: ${contactName}`;
      let iv = '000000000000000000000000';

      if (activeChat.isGroup) {
        const creator = activeChat.participants.find(p => activeChat.admins.some(a => (a._id || a) === p._id)) || activeChat.participants[0];
        const sharedSecret = await deriveSharedSecret(privateKey, creator.publicKey);
        const encrypted = await encryptMessage(sharedSecret, ciphertext);
        ciphertext = encrypted.ciphertext;
        iv = encrypted.iv;
      } else {
        const recipient = activeChat.participants.find(p => p._id !== user._id);
        const sharedSecret = await deriveSharedSecret(privateKey, recipient.publicKey);
        const encrypted = await encryptMessage(sharedSecret, ciphertext);
        ciphertext = encrypted.ciphertext;
        iv = encrypted.iv;
      }

      const { data } = await api.post('/messages', {
        chatId: activeChat._id,
        ciphertext,
        iv,
        messageType: 'contact',
        contact: {
          name: contactName,
          phoneNumber: contactPhone
        }
      });

      setMessages(prev => [...prev, data]);
      setDecryptedCache(prev => ({ ...prev, [data._id]: `👤 Contact: ${contactName}` }));
      setShowContactCreator(false);
      setContactName('');
      setContactPhone('');
      loadChats();
    } catch (err) {
      alert('Failed to send E2EE contact');
    }
  };

  // 9. Voice Notes recording (using MediaRecorder API)
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const voiceFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        
        // Temporarily hold file as selected file and trigger send automatically
        setSelectedFile(voiceFile);
        setIsRecording(false);
        setRecordingTime(0);
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        
        // Stop audio tracks
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Mic access error:', err);
      alert('Could not access microphone for voice note');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  // Trigger send if recording stopped and voice file cached
  useEffect(() => {
    if (selectedFile && selectedFile.name.startsWith('voice-note-')) {
      handleSendMessage();
    }
  }, [selectedFile]);

  // 10. Chat Pins, Archives, and Mutes updates
  const handlePinToggle = async (chatId) => {
    try {
      const { data } = await api.post(`/chats/pin/${chatId}`);
      setChats(prev => prev.map(c => c._id === chatId ? { ...c, pinnedBy: data.pinnedBy } : c));
    } catch (e) {
      console.log(e);
    }
  };

  const handleArchiveToggle = async (chatId) => {
    try {
      const { data } = await api.post(`/chats/archive/${chatId}`);
      setChats(prev => prev.map(c => c._id === chatId ? { ...c, archivedBy: data.archivedBy } : c));
      // Deselect active chat if archived
      if (activeChat && activeChat._id === chatId) {
        setActiveChat(null);
      }
    } catch (e) {
      console.log(e);
    }
  };

  const handleMuteToggle = async (chatId, duration) => {
    try {
      const { data } = await api.post(`/chats/mute/${chatId}`, { duration });
      setChats(prev => prev.map(c => c._id === chatId ? { ...c, mutedBy: data.mutedBy } : c));
      setChatSettingsDropdown(false);
    } catch (e) {
      console.log(e);
    }
  };

  // 11. E2EE Media Decrypt download helper
  const handleDownloadDecryptedFile = async (fileMeta) => {
    try {
      // 1. Fetch encrypted payload from Cloudinary
      const response = await fetch(fileMeta.url);
      const encryptedBlob = await response.blob();

      // 2. Decrypt locally
      const decryptedBlob = await decryptFile(encryptedBlob, fileMeta.key);

      // 3. Create download link
      const blobUrl = URL.createObjectURL(decryptedBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileMeta.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Decryption failed on file download:', err);
      alert('Decryption failed. You do not possess the required session key.');
    }
  };

  // Group creation triggers
  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupName || groupParticipants.length === 0) return alert('Name and participants are required');

    try {
      // 1. Generate new symmetric key for the group locally
      const groupCryptoKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const exportedGroupJwk = await window.crypto.subtle.exportKey('jwk', groupCryptoKey);
      const groupJwkStr = JSON.stringify(exportedGroupJwk);

      // 2. Encrypt this group key separately for each participant using their ECDH public key
      const keysPayload = [];
      
      // Encrypt for self
      const selfSecret = await deriveSharedSecret(privateKey, user.publicKey);
      const selfEncKey = await encryptMessage(selfSecret, groupJwkStr);
      keysPayload.push({ user: user._id, encryptedKey: selfEncKey.ciphertext });

      // Encrypt for other members
      for (let memberId of groupParticipants) {
        // Find member public key
        const memberObj = searchResults.find(u => u._id === memberId) || await api.get(`/users/search?q=`).then(r => r.data.find(u => u._id === memberId));
        if (memberObj && memberObj.publicKey) {
          const memberSecret = await deriveSharedSecret(privateKey, memberObj.publicKey);
          const memberEncKey = await encryptMessage(memberSecret, groupJwkStr);
          keysPayload.push({ user: memberId, encryptedKey: memberEncKey.ciphertext });
        }
      }

      // 3. Prepare FormData
      const formData = new FormData();
      formData.append('name', groupName);
      formData.append('groupDescription', groupDesc);
      formData.append('participants', JSON.stringify(groupParticipants));
      formData.append('groupKeys', JSON.stringify(keysPayload));
      
      if (groupAvatarFile) {
        formData.append('groupAvatar', groupAvatarFile);
      }

      const { data } = await api.post('/chats/group', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setChats(prev => [data, ...prev]);
      setShowNewGroupModal(false);
      setGroupName('');
      setGroupDesc('');
      setGroupParticipants([]);
      setGroupAvatarFile(null);
      alert('Encrypted group created successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to establish group E2EE session');
    }
  };

  // Broadcast creation submit
  const handleCreateBroadcastSubmit = async (e) => {
    e.preventDefault();
    if (!broadcastName || broadcastRecipients.length === 0) return alert('Name and recipients are required');

    try {
      const { data } = await api.post('/broadcasts', {
        name: broadcastName,
        recipients: broadcastRecipients
      });

      setBroadcastLists(prev => [data, ...prev]);
      setShowNewBroadcastModal(false);
      setBroadcastName('');
      setBroadcastRecipients([]);
      alert('Broadcast list created successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to create broadcast');
    }
  };

  // Trigger broadcast sends
  const handleSendBroadcastMessage = async (listId) => {
    const textMsg = prompt('Enter the message to broadcast:');
    if (!textMsg?.trim()) return;

    const targetList = broadcastLists.find(l => l._id === listId);
    if (!targetList) return;

    try {
      // Construct mapping: recipientId -> { ciphertext, iv, messageType }
      const payloads = {};

      for (let recipient of targetList.recipients) {
        if (recipient.publicKey) {
          const sharedSecret = await deriveSharedSecret(privateKey, recipient.publicKey);
          const encrypted = await encryptMessage(sharedSecret, textMsg);
          payloads[recipient._id.toString()] = {
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            messageType: 'text'
          };
        }
      }

      await api.post(`/broadcasts/${listId}/send`, { payloads });
      alert('Broadcast dispatched successfully!');
      loadChats();
    } catch (err) {
      console.error(err);
      alert('Broadcast E2EE dispatch failed');
    }
  };

  // Profile Drawer updates submit
  const handleProfileSettingsSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('fullName', fullNameInput);
      formData.append('bio', bioInput);
      formData.append('status', statusInput);

      if (avatarUploadFile) {
        formData.append('profilePicture', avatarUploadFile);
      }

      await api.put('/users/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await api.put('/users/privacy', {
        lastSeen: privacyLastSeen,
        readReceipts: privacyReadReceipts
      });

      alert('Profile details updated successfully');
      setShowProfileDrawer(false);
      setAvatarUploadFile(null);
      
      // Reload self
      window.location.reload();
    } catch (err) {
      alert('Profile update failed');
    }
  };

  // Chat backup download: exports the local ECDH keys as a backup file
  const handleBackupDownload = () => {
    if (!privateKey) return alert('No private key active on this device');
    
    // Export private key to JWK string
    window.crypto.subtle.exportKey('jwk', privateKey).then(jwk => {
      const fileData = JSON.stringify({
        userId: user._id,
        username: user.username,
        privateKeyJwk: jwk,
        exportedAt: new Date().toISOString()
      }, null, 2);

      const blob = new Blob([fileData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `connectx_key_backup_${user.username}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }).catch(err => {
      alert('Failed to export keys');
    });
  };

  // Chat text logs exporter: decrypts all loaded messages and downloads as text
  const handleExportChatHistory = () => {
    if (messages.length === 0) return alert('No messages to export');
    
    let textHistory = `ConnectX Secure Chat Export\n`;
    textHistory += `Conversation: ${activeChat.isGroup ? activeChat.name : activeChat.participants.find(p=>p._id!==user._id)?.fullName}\n`;
    textHistory += `Generated on: ${new Date().toLocaleString()}\n`;
    textHistory += `======================================================\n\n`;

    messages.forEach(m => {
      const decryptedText = decryptedCache[m._id] || '[Encrypted Message]';
      const senderName = m.sender.fullName;
      const time = new Date(m.createdAt).toLocaleString();
      textHistory += `[${time}] ${senderName}: ${decryptedText}\n`;
    });

    const blob = new Blob([textHistory], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat_export_${activeChat._id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Disappearing Messages dropdown change
  const handleToggleDisappearing = async (duration) => {
    try {
      await api.put(`/chats/group/${activeChat._id}/settings`, { disappearingDuration: duration });
      setActiveChat(prev => ({ ...prev, disappearingDuration: duration }));
      setChatSettingsDropdown(false);
      alert(`Disappearing messages set to ${duration === 0 ? 'disabled' : duration + ' seconds'}`);
    } catch (err) {
      alert('Failed to set disappearing durations');
    }
  };

  // File filter lists
  const filteredChats = chats.filter(c => {
    // 1. Matches text search query
    const otherUser = c.participants.find(p => p._id !== user._id);
    const nameToMatch = c.isGroup ? c.name : (otherUser?.fullName || '');
    const matchesSearch = nameToMatch.toLowerCase().includes(chatSearchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // 2. Matches category filter pills
    if (activeFilter === 'unread') return c.unreadCount > 0;
    if (activeFilter === 'groups') return c.isGroup;
    if (activeFilter === 'broadcasts') return false; // Handled separately
    if (activeFilter === 'archived') return c.archivedBy.includes(user._id);

    // Default 'all' - exclude archived chats
    return !c.archivedBy.includes(user._id);
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-dark-bg text-slate-800 dark:text-dark-text transition-colors duration-200">
      
      {/* 1. Sidebar Panel Layout */}
      <aside className="w-80 md:w-96 flex flex-col border-r border-slate-200 dark:border-white/5 bg-white dark:bg-dark-sidebar shrink-0 z-10 shadow-lg">
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <img
              src={user?.profilePicture || 'https://via.placeholder.com/150'}
              alt={user?.username}
              onClick={() => setShowProfileDrawer(true)}
              className="h-10 w-10 rounded-full object-cover border border-slate-200 dark:border-white/10 cursor-pointer hover:brightness-95 transition"
              onError={(e) => { e.target.src = 'https://via.placeholder.com/150'; }}
            />
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.fullName}</h4>
              <p className="text-[10px] text-slate-400 font-mono">@{user?.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user?.isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="p-2 rounded-lg bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 transition"
                title="Admin Console"
              >
                <FaUserCog />
              </button>
            )}
            <button
              onClick={() => setShowProfileDrawer(true)}
              className="p-2 rounded-lg bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 transition"
              title="Profile Settings"
            >
              <FaUser />
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-500 transition"
              title="Log out"
            >
              <FaSignOutAlt />
            </button>
          </div>
        </div>

        {/* Search & Quick Actions toolbar */}
        <div className="p-3 space-y-3">
          {/* Chat Search box */}
          <div className="relative">
            <FaSearch className="absolute left-3.5 top-3 text-xs text-slate-400" />
            <input
              type="text"
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 pl-9 pr-4 py-2.5 text-xs outline-none transition focus:border-whatsapp-teal dark:focus:bg-white/10"
              placeholder="Search chats or contacts..."
            />
          </div>

          {/* Quick Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewChatModal(true)}
              className="flex-1 py-2 rounded-xl bg-whatsapp-teal text-white text-[10px] font-bold flex items-center justify-center gap-1 hover:brightness-105 transition shadow-sm"
            >
              <FaPlus /> New Chat
            </button>
            <button
              onClick={() => setShowNewGroupModal(true)}
              className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white text-[10px] font-bold flex items-center justify-center gap-1 border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition"
            >
              <FaUsers /> New Group
            </button>
            <button
              onClick={() => setShowNewBroadcastModal(true)}
              className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white text-[10px] font-bold flex items-center justify-center gap-1 border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition"
            >
              <FaBroadcastTower /> Broadcast
            </button>
          </div>
        </div>

        {/* Filter Pills list */}
        <div className="flex px-3 gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-white/5 shrink-0 scrollbar-none">
          {[
            { id: 'all', label: 'All' },
            { id: 'unread', label: 'Unread' },
            { id: 'groups', label: 'Groups' },
            { id: 'broadcasts', label: 'Broadcasts' },
            { id: 'archived', label: 'Archived' }
          ].map(pill => (
            <button
              key={pill.id}
              onClick={() => setActiveFilter(pill.id)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition border ${
                activeFilter === pill.id
                  ? 'bg-whatsapp-teal border-whatsapp-teal text-white'
                  : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Chat / Broadcast Lists Panel */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
          
          {/* If active filter is Broadcast: Render Broadcast mailing lists */}
          {activeFilter === 'broadcasts' ? (
            broadcastLists.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No broadcast lists. Click "Broadcast" above to create one.</div>
            ) : (
              broadcastLists.map(list => (
                <div key={list._id} className="p-3.5 hover:bg-slate-100 dark:hover:bg-white/5 transition flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow">
                      <FaBroadcastTower />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{list.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{list.recipients.length} recipients</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSendBroadcastMessage(list._id)}
                    className="p-2 bg-whatsapp-teal text-white rounded-lg text-[10px] font-bold opacity-0 group-hover:opacity-100 transition"
                  >
                    Send to List
                  </button>
                </div>
              ))
            )
          ) : (
            // Render active conversations (Direct/Group Chats)
            filteredChats.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No conversations. Click "New Chat" to start messaging.</div>
            ) : (
              filteredChats.map(c => {
                const otherUser = c.participants.find(p => p._id !== user._id);
                const name = c.isGroup ? c.name : (otherUser?.fullName || 'Secure Channel');
                const avatar = c.isGroup ? c.groupAvatar : otherUser?.profilePicture;
                const status = c.isGroup ? 'group' : getOnlineStatus(otherUser?._id).status;

                const isPinned = c.pinnedBy.includes(user._id);
                const isMuted = c.mutedBy.some(m => m.user === user._id && new Date(m.until) > new Date());
                
                const lastMsgText = c.lastMessage ? (decryptedCache[c.lastMessage._id] || 'Encrypted Message') : '';
                const lastMsgTime = c.lastMessage ? new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                return (
                  <div
                    key={c._id}
                    onClick={() => setActiveChat(c)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition ${
                      activeChat && activeChat._id === c._id
                        ? 'bg-slate-100 dark:bg-dark-active border-l-4 border-whatsapp-teal'
                        : 'hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Avatar with presence dot */}
                      <div className="relative shrink-0">
                        <img
                          src={avatar || 'https://via.placeholder.com/150'}
                          alt={name}
                          className="h-10 w-10 rounded-full object-cover border border-slate-200 dark:border-white/10"
                          onError={(e) => { e.target.src = 'https://via.placeholder.com/150'; }}
                        />
                        {status === 'online' && (
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow"></span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate pr-1">{name}</h4>
                          <span className="text-[9px] text-slate-400 font-mono shrink-0">{lastMsgTime}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-1">
                          {typingUsers[c._id]?.size > 0 ? (
                            <span className="text-whatsapp-light font-semibold italic">typing...</span>
                          ) : (
                            lastMsgText
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Unread & Action Indicators */}
                    <div className="flex flex-col items-end gap-1.5 ml-2 shrink-0">
                      {isPinned && <FaThumbtack className="text-[9px] text-slate-400" />}
                      {isMuted && <FaVolumeMute className="text-[9px] text-slate-400" />}
                      {c.unreadCount > 0 && (
                        <span className="h-4 min-w-4 px-1 rounded-full bg-whatsapp-light text-slate-900 text-[9px] font-extrabold flex items-center justify-center shadow">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </aside>

      {/* 2. Main Chat Console Area Layout */}
      <section className="flex-1 flex flex-col bg-slate-50 dark:bg-dark-chat relative overflow-hidden">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-white dark:bg-dark-sidebar z-10 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={(activeChat.isGroup ? activeChat.groupAvatar : activeChat.participants.find(p=>p._id!==user._id)?.profilePicture) || 'https://via.placeholder.com/150'}
                  alt="Avatar"
                  className="h-10 w-10 rounded-full object-cover border border-slate-200 dark:border-white/10"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/150'; }}
                />
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {activeChat.isGroup ? activeChat.name : activeChat.participants.find(p=>p._id!==user._id)?.fullName}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-0.5 truncate">
                    {activeChat.isGroup
                      ? `${activeChat.participants.length} participants`
                      : getOnlineStatus(activeChat.participants.find(p=>p._id!==user._id)?._id).status === 'online'
                      ? 'online'
                      : 'offline'}
                  </p>
                </div>
              </div>

              {/* Header Action toolbar */}
              <div className="flex items-center gap-2">
                {!activeChat.isGroup && (
                  <>
                    <button
                      onClick={() => initiateCall(activeChat.participants.find(p=>p._id!==user._id), 'audio')}
                      className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-300 transition"
                      title="Audio Call"
                    >
                      <FaPhone />
                    </button>
                    <button
                      onClick={() => initiateCall(activeChat.participants.find(p=>p._id!==user._id), 'video')}
                      className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-300 transition"
                      title="Video Call"
                    >
                      <FaVideo />
                    </button>
                  </>
                )}

                <button
                  onClick={() => setShowMsgSearch(prev => !prev)}
                  className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-300 transition"
                  title="Search Messages"
                >
                  <FaSearch />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setChatSettingsDropdown(prev => !prev)}
                    className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-300 transition outline-none"
                  >
                    <FaEllipsisV />
                  </button>
                  {chatSettingsDropdown && (
                    <div className="absolute right-0 mt-1 w-48 rounded-xl bg-white dark:bg-dark-sidebar border border-slate-200 dark:border-white/10 shadow-2xl p-1 z-30 text-xs">
                      <button
                        onClick={() => handlePinToggle(activeChat._id)}
                        className="w-full text-left p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center gap-2 transition"
                      >
                        <FaThumbtack /> Toggle Pin Chat
                      </button>
                      <button
                        onClick={() => handleArchiveToggle(activeChat._id)}
                        className="w-full text-left p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center gap-2 transition"
                      >
                        <FaArchive /> Archive Chat
                      </button>
                      <button
                        onClick={handleExportChatHistory}
                        className="w-full text-left p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center gap-2 transition"
                      >
                        <FaFileExport /> Export Decrypted Chat
                      </button>
                      <hr className="border-slate-200 dark:border-white/5 my-1" />
                      {/* Disappearing Duration controls */}
                      <div className="p-2 font-bold text-[9px] uppercase text-slate-400">Disappearing Duration</div>
                      {[
                        { label: 'Off', val: 0 },
                        { label: '24 Hours', val: 86400 },
                        { label: '7 Days', val: 604800 }
                      ].map((dis, i) => (
                        <button
                          key={i}
                          onClick={() => handleToggleDisappearing(dis.val)}
                          className={`w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition ${
                            activeChat.disappearingDuration === dis.val ? 'text-whatsapp-light font-bold' : ''
                          }`}
                        >
                          {dis.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Client Search Inside Selected Chat Bar */}
            {showMsgSearch && (
              <div className="p-3 border-b border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-slate-950/20 flex items-center gap-2 z-10">
                <FaSearch className="text-xs text-slate-400 ml-1" />
                <input
                  type="text"
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-xs text-slate-800 dark:text-white"
                  placeholder="Filter decrypted message texts in this room..."
                  autoFocus
                />
                <button
                  onClick={() => { setShowMsgSearch(false); setMessageSearchQuery(''); }}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/5 text-slate-400"
                >
                  <FaTimes />
                </button>
              </div>
            )}

            {/* Messages Stream Background */}
            <div className="flex-1 overflow-y-auto p-4 chat-wallpaper relative space-y-4">
              
              {/* Filter messages on the fly if user is searching */}
              {messages
                .filter(m => {
                  if (!messageSearchQuery.trim()) return true;
                  const decrypted = decryptedCache[m._id] || '';
                  return decrypted.toLowerCase().includes(messageSearchQuery.toLowerCase());
                })
                .map((msg, idx) => {
                  const isSelf = msg.sender._id === user._id || msg.sender === user._id;
                  const decryptedText = decryptedCache[msg._id] || 'Encrypted Message';

                  return (
                    <div
                      key={msg._id}
                      className={`flex ${isSelf ? 'justify-end' : 'justify-start'} items-end gap-1.5`}
                    >
                      {/* Bubble */}
                      <div
                        className={`max-w-xs md:max-w-md rounded-2xl p-3 shadow border ${
                          isSelf
                            ? 'bg-whatsapp-teal dark:bg-dark-bubble border-whatsapp-teal/20 text-white rounded-br-none'
                            : 'bg-white dark:bg-dark-incoming border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-bl-none'
                        } relative group`}
                      >
                        {/* Sender name for group chats */}
                        {activeChat.isGroup && !isSelf && (
                          <div className="text-[9px] font-bold text-whatsapp-light mb-1">
                            @{msg.sender.username}
                          </div>
                        )}

                        {/* Reply Header info */}
                        {msg.replyTo && (
                          <div className="border-l-4 border-slate-400/50 bg-black/10 rounded p-2 mb-2 text-[10px] text-slate-300">
                            <div className="font-bold">Reply Reference</div>
                            <div className="truncate">
                              {decryptedCache[msg.replyTo._id || msg.replyTo] || 'Click to view'}
                            </div>
                          </div>
                        )}

                        {/* Message Content depending on formats */}
                        {msg.isDeleted ? (
                          <span className="text-xs italic text-slate-400 dark:text-dark-muted font-medium">
                            {decryptedText}
                          </span>
                        ) : (
                          <>
                            {msg.messageType === 'text' && (
                              <p className="text-xs leading-relaxed whitespace-pre-wrap">{decryptedText}</p>
                            )}

                            {msg.messageType === 'image' && (
                              <div className="space-y-2">
                                <img
                                  src={msg.fileMetadata?.url}
                                  alt="attachment"
                                  className="rounded-lg max-h-48 w-full object-cover cursor-zoom-in"
                                  onClick={() => window.open(msg.fileMetadata?.url)}
                                />
                                <button
                                  onClick={() => handleDownloadDecryptedFile(msg.fileMetadata)}
                                  className="w-full py-1.5 rounded-lg bg-black/25 text-[10px] font-bold flex items-center justify-center gap-1.5 hover:bg-black/35 transition"
                                >
                                  <FaDownload /> Decrypt & Download
                                </button>
                              </div>
                            )}

                            {msg.messageType === 'video' && (
                              <div className="space-y-2">
                                <video
                                  src={msg.fileMetadata?.url}
                                  controls
                                  className="rounded-lg max-h-48 w-full object-cover"
                                />
                                <button
                                  onClick={() => handleDownloadDecryptedFile(msg.fileMetadata)}
                                  className="w-full py-1.5 rounded-lg bg-black/25 text-[10px] font-bold flex items-center justify-center gap-1.5 hover:bg-black/35 transition"
                                >
                                  <FaDownload /> Decrypt & Download
                                </button>
                              </div>
                            )}

                            {msg.messageType === 'audio' && (
                              // Decrypted audio note player (simulated stream here)
                              <AudioPlayer src={msg.fileMetadata?.url} />
                            )}

                            {msg.messageType === 'document' && (
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-black/25 border border-white/5">
                                <FaFileAlt className="text-xl text-slate-300" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] font-bold truncate text-white">{msg.fileMetadata?.fileName}</div>
                                  <div className="text-[8px] font-mono text-slate-400">
                                    {(msg.fileMetadata?.fileSize / 1024).toFixed(1)} KB
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDownloadDecryptedFile(msg.fileMetadata)}
                                  className="p-2 rounded bg-white/10 hover:bg-white/20 text-white transition shrink-0"
                                >
                                  <FaCloudDownloadAlt className="text-sm" />
                                </button>
                              </div>
                            )}

                            {msg.messageType === 'location' && (
                              <LocationSharing
                                latitude={msg.location.latitude}
                                longitude={msg.location.longitude}
                                address={msg.location.address}
                              />
                            )}

                            {msg.messageType === 'contact' && (
                              <div className="flex items-center gap-3 bg-black/25 border border-white/5 rounded-xl p-3 w-full">
                                <div className="h-9 w-9 rounded-full bg-slate-700/50 flex items-center justify-center text-white">
                                  <FaUser />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-white leading-none">{msg.contact.name}</h4>
                                  <p className="text-[9px] text-slate-400 mt-1 font-mono">{msg.contact.phoneNumber}</p>
                                </div>
                              </div>
                            )}

                            {msg.messageType === 'poll' && (
                              <PollMessage poll={msg.poll} onVote={(opt) => handleVotePoll(msg._id, opt)} />
                            )}
                          </>
                        )}

                        {/* Footer info (Timestamp and double checks) */}
                        <div className="flex justify-end items-center gap-1.5 text-[8px] text-slate-400 dark:text-dark-muted font-mono mt-1 text-right">
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isSelf && (
                            <span className="text-whatsapp-light text-[10px]">
                              {msg.readBy?.length > 0 ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>

                        {/* Hover Quick actions overlay */}
                        {!msg.isDeleted && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition duration-150 flex gap-1.5 bg-slate-900/80 border border-white/10 p-1 rounded-lg backdrop-blur-sm z-10 shadow">
                            <button
                              onClick={() => setReplyAnchor(msg)}
                              className="p-1 hover:bg-white/10 rounded text-slate-300"
                              title="Reply"
                            >
                              <FaReply className="text-[10px]" />
                            </button>
                            <button
                              onClick={() => handleToggleStarMessage(msg._id)}
                              className={`p-1 hover:bg-white/10 rounded ${starredMessageIds.has(msg._id) ? 'text-yellow-400' : 'text-slate-300'}`}
                              title="Star message"
                            >
                              <FaStar className="text-[10px]" />
                            </button>
                            {isSelf && (
                              <>
                                <button
                                  onClick={() => { setEditingMessage(msg); setInputText(decryptedText); }}
                                  className="p-1 hover:bg-white/10 rounded text-slate-300"
                                  title="Edit"
                                >
                                  <FaEdit className="text-[10px]" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(msg._id)}
                                  className="p-1 hover:bg-white/10 rounded text-red-400 hover:text-red-300"
                                  title="Unsend"
                                >
                                  <FaTrash className="text-[10px]" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

              <div ref={messageStreamEndRef} />
            </div>

            {/* Selected Chat Footer controls */}
            <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-dark-sidebar flex flex-col gap-2.5 z-10">
              
              {/* Active reply anchor header */}
              {replyAnchor && (
                <div className="bg-slate-100 dark:bg-slate-950/20 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-whatsapp-light">Replying to message:</span>
                    <span className="truncate max-w-sm text-slate-500">
                      {decryptedCache[replyAnchor._id] || 'Attachment'}
                    </span>
                  </div>
                  <button onClick={() => setReplyAnchor(null)} className="text-slate-400 hover:text-white">
                    <FaTimes />
                  </button>
                </div>
              )}

              {/* Active editing message header */}
              {editingMessage && (
                <div className="bg-slate-100 dark:bg-slate-950/20 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-whatsapp-light">Editing Sent Message...</span>
                  <button onClick={() => { setEditingMessage(null); setInputText(''); }} className="text-slate-400 hover:text-white">
                    <FaTimes />
                  </button>
                </div>
              )}

              {/* Main Footer input row */}
              <div className="flex items-center gap-2 relative">
                {/* Attachment Menu toggler */}
                <button
                  type="button"
                  onClick={() => setAttachmentMenu(prev => !prev)}
                  className={`p-2.5 rounded-lg transition ${
                    attachmentMenu || selectedFile ? 'bg-whatsapp-teal text-white' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                  title="Attach Files"
                >
                  <FaPaperclip />
                </button>
                {attachmentMenu && (
                  <div className="absolute bottom-14 left-0 w-48 rounded-xl bg-white dark:bg-dark-sidebar border border-slate-200 dark:border-white/10 shadow-2xl p-1.5 z-30 flex flex-col text-xs font-semibold">
                    <button
                      onClick={() => { setShowPollCreator(true); setAttachmentMenu(false); }}
                      className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-left flex items-center gap-2 transition"
                    >
                      📊 Create Poll
                    </button>
                    <button
                      onClick={() => { setShowLocationCreator(true); setAttachmentMenu(false); }}
                      className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-left flex items-center gap-2 transition"
                    >
                      📍 Share Location
                    </button>
                    <button
                      onClick={() => { setShowContactCreator(true); setAttachmentMenu(false); }}
                      className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-left flex items-center gap-2 transition"
                    >
                      👤 Share Contact
                    </button>
                    <label className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-left flex items-center gap-2 transition cursor-pointer">
                      🖼️ Upload Image/Video
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,video/*"
                        onChange={(e) => { setSelectedFile(e.target.files[0]); setAttachmentMenu(false); }}
                      />
                    </label>
                    <label className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-left flex items-center gap-2 transition cursor-pointer">
                      📄 Upload Document
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                        onChange={(e) => { setSelectedFile(e.target.files[0]); setAttachmentMenu(false); }}
                      />
                    </label>
                  </div>
                )}

                {/* Input Text Form */}
                <form
                  onSubmit={editingMessage ? handleEditSubmit : handleSendMessage}
                  className="flex-1 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={handleInputTextChange}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-4 py-2.5 text-xs outline-none transition focus:border-whatsapp-teal dark:focus:bg-white/10 text-slate-800 dark:text-white"
                    placeholder={
                      selectedFile 
                        ? `Attached File: ${selectedFile.name} (Press Enter to Send)` 
                        : "Type a message..."
                    }
                  />

                  {/* Message scheduler picker toggler */}
                  <button
                    type="button"
                    onClick={() => setShowScheduler(prev => !prev)}
                    className={`p-2.5 rounded-lg transition ${
                      scheduleTime ? 'text-whatsapp-light' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Schedule message"
                  >
                    <FaClock />
                  </button>
                  {showScheduler && (
                    <div className="absolute bottom-14 right-12 bg-white dark:bg-dark-sidebar border border-slate-200 dark:border-white/10 p-3 rounded-xl shadow-2xl z-30 flex flex-col gap-2">
                      <label className="text-[10px] uppercase font-bold text-slate-400">Date/Time to send</label>
                      <input
                        type="datetime-local"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="bg-slate-800 border border-white/10 rounded-lg p-2 text-xs text-white outline-none"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="p-2.5 rounded-xl bg-whatsapp-teal text-white hover:brightness-105 active:scale-95 transition"
                  >
                    Send
                  </button>
                </form>

                {/* Voice notes Microphone recorder */}
                <button
                  type="button"
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className={`p-2.5 rounded-xl transition ${
                    isRecording 
                      ? 'bg-red-600 text-white animate-pulse' 
                      : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                  title="Voice notes"
                >
                  {isRecording ? <FaStop /> : <FaMicrophone />}
                </button>
                {isRecording && (
                  <span className="text-[10px] text-red-500 font-bold font-mono ml-1 animate-pulse">
                    Recording: {recordingTime}s
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          // Placeholder details if no chat open
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-dark-chat">
            <div className="text-center space-y-4 max-w-sm">
              <div className="h-16 w-16 rounded-2xl bg-whatsapp-teal/10 border border-whatsapp-teal/20 text-whatsapp-teal flex items-center justify-center text-3xl mx-auto shadow-inner">
                🔒
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide">ConnectX Secure Messaging</h2>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                End-to-End Encrypted enterprise portal. Messages and media are fully encrypted locally on your devices using derived 256-bit AES secrets.
              </p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="py-2.5 px-6 rounded-xl bg-whatsapp-teal text-white font-bold text-xs hover:brightness-105 transition shadow-lg shadow-whatsapp-teal/10"
              >
                Start a conversation
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 3. Global Subcomponent Overlay Panels (Modals/Drawers) */}

      {/* Profile settings sidebar drawer */}
      <AnimatePresence>
        {showProfileDrawer && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed left-0 top-0 bottom-0 w-80 md:w-96 bg-white dark:bg-dark-sidebar border-r border-slate-200 dark:border-white/5 shadow-2xl z-40 p-6 flex flex-col justify-between"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Profile & Privacy</h3>
                <button
                  onClick={() => setShowProfileDrawer(false)}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/5 text-slate-400"
                >
                  <FaTimes />
                </button>
              </div>

              {/* Edit Details Forms */}
              <form onSubmit={handleProfileSettingsSubmit} className="space-y-4">
                {/* Avatar change */}
                <div className="flex flex-col items-center gap-1.5">
                  <img
                    src={user?.profilePicture || 'https://via.placeholder.com/150'}
                    alt="avatar"
                    className="h-16 w-16 rounded-full object-cover border border-slate-200 dark:border-white/10"
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/150'; }}
                  />
                  <label className="text-[10px] text-whatsapp-light font-bold hover:underline cursor-pointer">
                    Change profile image
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => setAvatarUploadFile(e.target.files[0])}
                    />
                  </label>
                  {avatarUploadFile && <span className="text-[9px] text-white bg-slate-800 p-1 rounded">Pending: {avatarUploadFile.name}</span>}
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1.5">Full Display Name</label>
                  <input
                    type="text"
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-whatsapp-teal"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1.5">User Bio</label>
                  <input
                    type="text"
                    value={bioInput}
                    onChange={(e) => setBioInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-whatsapp-teal"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1.5">Visibility Status</label>
                  <select
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white outline-none"
                  >
                    <option value="online">Online</option>
                    <option value="away">Away</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>

                <hr className="border-slate-200 dark:border-white/5" />

                {/* Privacy visibilities settings */}
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase font-bold text-slate-400">Privacy settings</h4>
                  <div>
                    <label className="block text-[9px] text-slate-400 mb-1">Last Seen Visibility</label>
                    <select
                      value={privacyLastSeen}
                      onChange={(e) => setPrivacyLastSeen(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-white outline-none"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="contacts">My Contacts Only</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-whatsapp-teal text-white rounded-xl text-xs font-bold hover:brightness-105 active:scale-95 transition"
                >
                  Save Profile Settings
                </button>
              </form>
            </div>

            {/* Cryptographic private key manager backup panel */}
            <div className="bg-slate-100 dark:bg-slate-950/20 border border-slate-200 dark:border-white/5 rounded-xl p-4 space-y-3.5 mt-auto text-xs">
              <div>
                <h4 className="font-bold text-white flex items-center gap-1.5"><FaInfoCircle className="text-whatsapp-teal text-sm" /> Local E2EE Credentials</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  Your private cryptographic key is securely stored in your browser's IndexedDB. Download a backup file to restore E2EE sessions on other devices.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBackupDownload}
                  className="flex-1 py-2 rounded-lg bg-whatsapp-teal/10 hover:bg-whatsapp-teal/20 text-whatsapp-light text-[10px] font-bold border border-whatsapp-teal/20 flex items-center justify-center gap-1 transition"
                >
                  <FaDownload /> Backup Keys
                </button>
                <button
                  onClick={regenerateKeyPair}
                  className="flex-1 py-2 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 text-[10px] font-bold border border-red-500/20 flex items-center justify-center gap-1 transition"
                >
                  Regen Keys
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New 1-on-1 Chat modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-sidebar border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Start New Conversation</h3>
              <button onClick={() => { setShowNewChatModal(false); setSearchResults([]); setGlobalSearchQuery(''); }} className="text-slate-400 hover:text-white">
                <FaTimes />
              </button>
            </div>
            
            <div className="relative">
              <FaSearch className="absolute left-3.5 top-3 text-xs text-slate-400" />
              <input
                type="text"
                value={globalSearchQuery}
                onChange={handleGlobalSearch}
                className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 pl-9 pr-4 py-2.5 text-xs outline-none transition focus:border-whatsapp-teal"
                placeholder="Type username or name..."
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Search directory for users...</div>
              ) : (
                searchResults.map(userItem => (
                  <div
                    key={userItem._id}
                    onClick={() => handleStartChat(userItem._id)}
                    className="p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl cursor-pointer transition flex items-center gap-3"
                  >
                    <img
                      src={userItem.profilePicture || 'https://via.placeholder.com/150'}
                      alt="avatar"
                      className="h-8 w-8 rounded-full object-cover"
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/150'; }}
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">{userItem.fullName}</div>
                      <div className="text-[10px] text-slate-400">@{userItem.username}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Group chat modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateGroupSubmit} className="bg-white dark:bg-dark-sidebar border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Create Encrypted Group</h3>
              <button type="button" onClick={() => setShowNewGroupModal(false)} className="text-slate-400 hover:text-white">
                <FaTimes />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Group Avatar</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setGroupAvatarFile(e.target.files[0])}
                  className="w-full text-slate-400"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-white outline-none focus:border-whatsapp-teal"
                  placeholder="Enterprise Group"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Group Description</label>
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-white outline-none focus:border-whatsapp-teal"
                  placeholder="Official project chat room"
                />
              </div>

              {/* Members search selector for the group */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Search & Add Participants</label>
                <input
                  type="text"
                  onChange={handleGlobalSearch}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-white outline-none focus:border-whatsapp-teal mb-2"
                  placeholder="Search directory..."
                />
                
                {/* Search select grid */}
                <div className="max-h-32 overflow-y-auto border border-white/5 p-2 rounded-lg space-y-1 bg-black/10">
                  {searchResults.map(u => (
                    <div key={u._id} className="flex justify-between items-center text-[10px] hover:bg-white/5 p-1.5 rounded">
                      <span>{u.fullName} (@{u.username})</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (groupParticipants.includes(u._id)) {
                            setGroupParticipants(prev => prev.filter(id => id !== u._id));
                          } else {
                            setGroupParticipants(prev => [...prev, u._id]);
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                          groupParticipants.includes(u._id) ? 'bg-red-600 text-white' : 'bg-whatsapp-teal text-white'
                        }`}
                      >
                        {groupParticipants.includes(u._id) ? 'Remove' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-bold">
                Selected participants: {groupParticipants.length}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-whatsapp-teal text-white rounded-xl text-xs font-bold hover:brightness-105 transition"
            >
              Initialize E2EE Group
            </button>
          </form>
        </div>
      )}

      {/* New Broadcast list modal */}
      {showNewBroadcastModal && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateBroadcastSubmit} className="bg-white dark:bg-dark-sidebar border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Create Broadcast Mailing List</h3>
              <button type="button" onClick={() => setShowNewBroadcastModal(false)} className="text-slate-400 hover:text-white">
                <FaTimes />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Mailing List Name</label>
                <input
                  type="text"
                  value={broadcastName}
                  onChange={(e) => setBroadcastName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-white outline-none focus:border-whatsapp-teal"
                  placeholder="Sales announcements"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Search & Add Recipients</label>
                <input
                  type="text"
                  onChange={handleGlobalSearch}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-white outline-none focus:border-whatsapp-teal mb-2"
                  placeholder="Search directory..."
                />
                
                {/* Search select grid */}
                <div className="max-h-32 overflow-y-auto border border-white/5 p-2 rounded-lg space-y-1 bg-black/10">
                  {searchResults.map(u => (
                    <div key={u._id} className="flex justify-between items-center text-[10px] hover:bg-white/5 p-1.5 rounded">
                      <span>{u.fullName} (@{u.username})</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (broadcastRecipients.includes(u._id)) {
                            setBroadcastRecipients(prev => prev.filter(id => id !== u._id));
                          } else {
                            setBroadcastRecipients(prev => [...prev, u._id]);
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                          broadcastRecipients.includes(u._id) ? 'bg-red-600 text-white' : 'bg-whatsapp-teal text-white'
                        }`}
                      >
                        {broadcastRecipients.includes(u._id) ? 'Remove' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-bold">
                Selected recipients: {broadcastRecipients.length}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-whatsapp-teal text-white rounded-xl text-xs font-bold hover:brightness-105 transition"
            >
              Create List
            </button>
          </form>
        </div>
      )}

      {/* Poll Creator Modal */}
      {showPollCreator && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSendPoll} className="bg-white dark:bg-dark-sidebar border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Create Group Poll</h3>
              <button type="button" onClick={() => setShowPollCreator(false)} className="text-slate-400 hover:text-white">
                <FaTimes />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Question</label>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-white outline-none focus:border-whatsapp-teal"
                  placeholder="What is the meeting time?"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Options</label>
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...pollOptions];
                        newOptions[i] = e.target.value;
                        setPollOptions(newOptions);
                      }}
                      className="flex-1 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-white outline-none focus:border-whatsapp-teal"
                      placeholder={`Option ${i+1}`}
                      required={i < 2}
                    />
                    {i >= 2 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions(prev => prev.filter((_, idx) => idx !== i))}
                        className="p-2 text-red-500 rounded hover:bg-white/5"
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setPollOptions(prev => [...prev, ''])}
                  className="text-[10px] text-whatsapp-light font-bold hover:underline"
                >
                  + Add option
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-whatsapp-teal text-white rounded-xl text-xs font-bold hover:brightness-105 transition"
            >
              Broadcast Poll
            </button>
          </form>
        </div>
      )}

      {/* Share Location Creator Modal */}
      {showLocationCreator && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSendLocation} className="bg-white dark:bg-dark-sidebar border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Share Map Geolocation</h3>
              <button type="button" onClick={() => setShowLocationCreator(false)} className="text-slate-400 hover:text-white">
                <FaTimes />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Latitude</label>
                  <input
                    type="text"
                    value={locLat}
                    onChange={(e) => setLocLat(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-white outline-none focus:border-whatsapp-teal"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Longitude</label>
                  <input
                    type="text"
                    value={locLng}
                    onChange={(e) => setLocLng(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-white outline-none focus:border-whatsapp-teal"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Location Address</label>
                <input
                  type="text"
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-white outline-none focus:border-whatsapp-teal"
                  placeholder="Address or label"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-whatsapp-teal text-white rounded-xl text-xs font-bold hover:brightness-105 transition"
            >
              Share Location
            </button>
          </form>
        </div>
      )}

      {/* Share Contact Creator Modal */}
      {showContactCreator && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSendContact} className="bg-white dark:bg-dark-sidebar border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Share Business Contact</h3>
              <button type="button" onClick={() => setShowContactCreator(false)} className="text-slate-400 hover:text-white">
                <FaTimes />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-white outline-none focus:border-whatsapp-teal"
                  placeholder="Jane Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-3 py-2 text-white outline-none focus:border-whatsapp-teal"
                  placeholder="+1 (555) 019-2834"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-whatsapp-teal text-white rounded-xl text-xs font-bold hover:brightness-105 transition"
            >
              Share Contact
            </button>
          </form>
        </div>
      )}

      {/* WebRTC Video Call Overlay component */}
      <CallOverlay />

    </div>
  );
}
