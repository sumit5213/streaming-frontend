import React, { useEffect, useRef, useState } from 'react';

const CircularVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState(""); 
  
  const audioContextRef = useRef<any | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startListening = async () => {
    try {
      // WebSocket is added
      const socket = new WebSocket('wss://streaming-backend-gmpf.onrender.com');
      socketRef.current = socket;

      socket.onopen = () => console.log("Connected to Backend");
      socket.onmessage = (event) => {
        setTranscription(prev => prev + " " + event.data);
      };

      // Audio for the listening
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      audioContextRef.current = new AudioContextClass();
      const ctx = audioContextRef.current;
      const source = ctx.createMediaStreamSource(stream);
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256; 
      source.connect(analyser);
      analyserRef.current = analyser;

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
         if (socket.readyState === WebSocket.OPEN) {
             const inputData = e.inputBuffer.getChannelData(0);
             const buffer = new ArrayBuffer(inputData.length * 2);
             const view = new DataView(buffer);
             for (let i = 0; i < inputData.length; i++) {
                 const s = Math.max(-1, Math.min(1, inputData[i]));
                 view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
             }
             socket.send(buffer);
         }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      
      setIsListening(true);
      draw();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied.");
    }
  };
  // stoping the microphone
  const stopListening = () => {
    setIsListening(false);
    cancelAnimationFrame(animationRef.current);

    if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
  };

  // clearing the transcription
  const clearCanvas = () => {
    setTranscription(""); 
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#000'; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const renderFrame = () => {
      if (!analyser) return;
      animationRef.current = requestAnimationFrame(renderFrame);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#000'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 90; 

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * 140; 
        const rads = (Math.PI * 2) * (i / bufferLength);

        const x_start = centerX + Math.cos(rads) * radius;
        const y_start = centerY + Math.sin(rads) * radius;
        const x_end = centerX + Math.cos(rads) * (radius + barHeight);
        const y_end = centerY + Math.sin(rads) * (radius + barHeight);

        const hue = i * 2 + 180; 
        ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(x_start, y_start);
        ctx.lineTo(x_end, y_end);
        ctx.stroke();
      }
    };
    renderFrame();
  };

  useEffect(() => {
    return () => stopListening(); 
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950 text-white p-8 gap-12">
      
      <div className="flex flex-col items-center gap-8">
          <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
              <canvas 
                ref={canvasRef} 
                width={500} 
                height={500}
                className="relative rounded-full shadow-2xl shadow-blue-900/20 bg-black border border-white/5"
              />
          </div>

          {!isListening ? (
            <button 
              onClick={startListening}
              className="px-10 py-4 bg-blue-600 text-white font-bold rounded-full 
                         shadow-lg shadow-blue-500/30 
                         hover:bg-blue-500 hover:scale-105 hover:shadow-blue-500/60
                         active:scale-95 transition-all duration-200"
            >
              Start Microphone
            </button>
          ) : (
            <button 
              onClick={stopListening}
              className="px-10 py-4 bg-red-600 text-white font-bold rounded-full 
                         shadow-lg shadow-red-500/30 animate-pulse
                         hover:bg-red-500 hover:scale-105 hover:shadow-red-500/60
                         active:scale-95 transition-all duration-200"
            >
              Stop Listening
            </button>
          )}
      </div>

      {/* Right Side canvas box */}
      <div className="w-[400px] h-[500px] bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col shadow-2xl justify-between">
        
        {/* Header and Content of the transcription */}
        <div className="flex flex-col h-full overflow-hidden">
            <h2 className="text-xl font-semibold text-blue-400 mb-4 border-b border-white/10 pb-2">
            Live Transcript
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 text-gray-300 font-mono text-sm leading-relaxed scrollbar-thin scrollbar-thumb-blue-600 scrollbar-track-transparent">
            {transcription ? (
                <p>{transcription}</p>
            ) : (
                <p className="text-gray-600 italic">Waiting for audio...</p>
            )}
            </div>
        </div>

        {/* Clear Button*/}
        <button 
          onClick={clearCanvas}
          className="mt-4 w-full py-3 bg-gray-800 text-gray-300 font-semibold rounded-xl 
                     border border-white/10 
                     hover:bg-gray-700 hover:text-white hover:border-white/40 hover:shadow-lg
                     active:scale-95 transition-all duration-200"
        >
          Clear Text
        </button>
      </div>

    </div>
  );
};

export default CircularVisualizer;