import React, { useEffect, useRef, useState } from "react";
import { Mic, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const formatElapsed = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function AudioRecorder({ onRecorded, onRecordingChange, disabled }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const discardRef = useRef(false);

  const releaseMicrophone = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(
    () => () => {
      discardRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseMicrophone();
    },
    [],
  );

  const changeRecording = (value) => {
    setRecording(value);
    onRecordingChange?.(value);
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Seu navegador não suporta gravação de áudio");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      discardRef.current = false;
      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
      recorder.onstop = () => {
        releaseMicrophone();
        if (discardRef.current || chunks.length === 0) return;
        const mimeType = recorder.mimeType || "audio/webm";
        const extension = mimeType.includes("ogg") ? "ogg" : "webm";
        const baseType = mimeType.split(";")[0];
        onRecorded(new File(chunks, `audio.${extension}`, { type: baseType }));
      };
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.start();
      setElapsed(0);
      changeRecording(true);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const finish = (discard) => {
    discardRef.current = discard;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    changeRecording(false);
  };

  if (!recording) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={start}
        disabled={disabled}
        className="shrink-0"
        title="Gravar áudio"
        aria-label="Gravar áudio"
      >
        <Mic className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-2" role="group" aria-label="Gravando áudio">
      <Button variant="outline" size="icon" onClick={() => finish(true)} title="Cancelar gravação" aria-label="Cancelar gravação">
        <X className="w-4 h-4" />
      </Button>
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
      <span className="flex-1 text-sm tabular-nums" role="timer" aria-label="Tempo de gravação">
        {formatElapsed(elapsed)}
      </span>
      <Button size="icon" onClick={() => finish(false)} title="Enviar áudio" aria-label="Enviar áudio" className="bg-primary hover:bg-primary/90">
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}
