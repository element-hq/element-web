/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class Program
{
    private const uint AudioClientStreamFlagsLoopback = 0x00020000;
    private const uint AudioClientStreamFlagsEventCallback = 0x00040000;
    private const uint AudioClientStreamFlagsSourceDefaultQuality = 0x08000000;
    private const uint AudioClientStreamFlagsAutoConvertPcm = 0x80000000;
    private const uint AudioClientBufferFlagsDataDiscontinuity = 0x1;
    private const uint AudioClientBufferFlagsSilent = 0x2;
    private const ushort WaveFormatPcm = 1;
    private const ushort VariantBlob = 65;
    private const int AudioClientActivationTypeProcessLoopback = 1;
    private const string VirtualAudioDeviceProcessLoopback = "VAD\\Process_Loopback";
    private const uint StreamMagic = 0x414D4350;
    private const ushort StreamVersion = 1;
    private const uint StreamHeaderBytes = 48;

    private static readonly Guid AudioClientInterfaceId = new Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2");
    private static readonly Guid AudioCaptureClientInterfaceId = new Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317");
    private static volatile bool stopRequested;

    private static int Main(string[] args)
    {
        if (!Environment.Is64BitProcess)
        {
            return Fail("A 64-bit process is required.");
        }
        if (args.Length == 1 && string.Equals(args[0], "probe", StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine("protocol=1");
            Console.WriteLine("format=48000,2,pcm-s16le");
            return 0;
        }
        if (args.Length == 2 && string.Equals(args[0], "source", StringComparison.OrdinalIgnoreCase))
        {
            return ResolveSource(args[1]);
        }
        if (args.Length == 3 && string.Equals(args[0], "stream", StringComparison.OrdinalIgnoreCase))
        {
            uint processId;
            if (!uint.TryParse(args[1], out processId) || processId == 0)
            {
                return Fail("PID must be a positive decimal integer.");
            }
            bool include;
            if (string.Equals(args[2], "include", StringComparison.OrdinalIgnoreCase)) include = true;
            else if (string.Equals(args[2], "exclude", StringComparison.OrdinalIgnoreCase)) include = false;
            else return Fail("Capture mode is invalid.");
            return Stream(processId, include);
        }
        return 2;
    }

    private static int ResolveSource(string sourceId)
    {
        string[] components = sourceId.Split(':');
        ulong rawHandle;
        if (components.Length != 3 || components[0] != "window" || components[2] != "0" ||
            !ulong.TryParse(components[1], out rawHandle) || rawHandle == 0)
        {
            return Fail("Window source identifier is invalid.");
        }
        uint processId;
        if (GetWindowThreadProcessId(new IntPtr(unchecked((long)rawHandle)), out processId) == 0 || processId == 0)
        {
            return Fail("Window source is unavailable.");
        }
        Console.WriteLine("pid={0}", processId);
        return 0;
    }

    private static int Stream(uint processId, bool include)
    {
        Process target;
        try
        {
            target = Process.GetProcessById(checked((int)processId));
            if (target.HasExited) return Fail("Target process is unavailable.");
        }
        catch
        {
            return Fail("Target process is unavailable.");
        }

        int initializeResult = CoInitializeEx(IntPtr.Zero, 0);
        if (initializeResult < 0) return FailHResult("COM initialization", initializeResult);
        try
        {
            using (AutoResetEvent samplesReady = new AutoResetEvent(false))
            using (ManualResetEvent activationCompleted = new ManualResetEvent(false))
            using (Stream output = Console.OpenStandardOutput())
            using (BinaryWriter writer = new BinaryWriter(output, Encoding.ASCII))
            {
                CompletionHandler completionHandler = new CompletionHandler(activationCompleted);
                IntPtr activationData = IntPtr.Zero;
                IntPtr completionHandlerPointer = IntPtr.Zero;
                IntPtr operationPointer = IntPtr.Zero;
                try
                {
                    activationData = Marshal.AllocCoTaskMem(Marshal.SizeOf(typeof(AudioClientActivationParams)));
                    AudioClientActivationParams activationParams = new AudioClientActivationParams();
                    activationParams.ActivationType = AudioClientActivationTypeProcessLoopback;
                    activationParams.TargetProcessId = processId;
                    activationParams.ProcessLoopbackMode = include ? 0 : 1;
                    Marshal.StructureToPtr(activationParams, activationData, false);

                    PropVariant propVariant = new PropVariant();
                    propVariant.VariantType = VariantBlob;
                    propVariant.Blob = new Blob((uint)Marshal.SizeOf(typeof(AudioClientActivationParams)), activationData);

                    Guid audioClientInterfaceId = AudioClientInterfaceId;
                    completionHandlerPointer = Marshal.GetComInterfaceForObject(
                        completionHandler,
                        typeof(IActivateAudioInterfaceCompletionHandler));
                    Guid agileObjectInterfaceId = new Guid("94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90");
                    IntPtr agileObjectPointer;
                    int agileQueryResult = Marshal.QueryInterface(
                        completionHandlerPointer,
                        ref agileObjectInterfaceId,
                        out agileObjectPointer);
                    if (agileQueryResult < 0) return FailHResult("Completion handler", agileQueryResult);
                    Marshal.Release(agileObjectPointer);

                    int activateResult = ActivateAudioInterfaceAsync(
                        VirtualAudioDeviceProcessLoopback,
                        ref audioClientInterfaceId,
                        ref propVariant,
                        completionHandlerPointer,
                        out operationPointer);
                    if (activateResult < 0) return FailHResult("Audio activation", activateResult);
                    if (!activationCompleted.WaitOne(TimeSpan.FromSeconds(10)))
                    {
                        return Fail("Audio activation timed out.");
                    }
                    if (completionHandler.Result < 0)
                    {
                        return FailHResult("Audio activation", completionHandler.Result);
                    }
                }
                finally
                {
                    if (activationData != IntPtr.Zero) Marshal.FreeCoTaskMem(activationData);
                    if (operationPointer != IntPtr.Zero) Marshal.Release(operationPointer);
                    if (completionHandlerPointer != IntPtr.Zero) Marshal.Release(completionHandlerPointer);
                }

                IAudioClient audioClient = (IAudioClient)completionHandler.AudioClient;
                WaveFormat captureFormat = WaveFormat.CreatePcm(48000, 2, 16);
                IntPtr formatPointer = Marshal.AllocCoTaskMem(Marshal.SizeOf(typeof(WaveFormat)));
                IAudioCaptureClient captureClient = null;
                try
                {
                    Marshal.StructureToPtr(captureFormat, formatPointer, false);
                    uint streamFlags = AudioClientStreamFlagsLoopback |
                        AudioClientStreamFlagsEventCallback |
                        AudioClientStreamFlagsAutoConvertPcm |
                        AudioClientStreamFlagsSourceDefaultQuality;
                    Guid sessionId = Guid.Empty;
                    CheckHResult("Audio initialization", audioClient.Initialize(
                        0, streamFlags, 0, 0, formatPointer, ref sessionId));
                    CheckHResult("Audio event", audioClient.SetEventHandle(samplesReady.SafeWaitHandle.DangerousGetHandle()));

                    object captureClientObject;
                    Guid captureInterfaceId = AudioCaptureClientInterfaceId;
                    CheckHResult("Audio capture service", audioClient.GetService(ref captureInterfaceId, out captureClientObject));
                    captureClient = (IAudioCaptureClient)captureClientObject;

                    WriteStreamStart(writer, processId, include, captureFormat);
                    CheckHResult("Audio start", audioClient.Start());
                    stopRequested = false;
                    Thread inputMonitor = new Thread(MonitorStreamControl);
                    inputMonitor.IsBackground = true;
                    inputMonitor.Name = "screen-share-audio-control";
                    inputMonitor.Start();

                    ulong sequence = 0;
                    ulong startFrame = 0;
                    long capturedBytes = 0;
                    int discontinuities = 0;
                    bool outputClosed = false;
                    bool targetExited = false;
                    while (!stopRequested && !outputClosed)
                    {
                        try
                        {
                            if (target.HasExited)
                            {
                                targetExited = true;
                                break;
                            }
                        }
                        catch
                        {
                            targetExited = true;
                            break;
                        }
                        samplesReady.WaitOne(250);
                        DrainPackets(
                            captureClient,
                            writer,
                            captureFormat.BlockAlign,
                            ref sequence,
                            ref startFrame,
                            ref capturedBytes,
                            ref discontinuities,
                            ref outputClosed);
                    }

                    int stopResult = audioClient.Stop();
                    if (stopResult >= 0 && !outputClosed)
                    {
                        DrainPackets(
                            captureClient,
                            writer,
                            captureFormat.BlockAlign,
                            ref sequence,
                            ref startFrame,
                            ref capturedBytes,
                            ref discontinuities,
                            ref outputClosed);
                    }
                    if (!outputClosed)
                    {
                        WriteStreamEnd(writer, sequence, startFrame, discontinuities, targetExited, capturedBytes);
                        writer.Flush();
                    }
                    return 0;
                }
                catch (COMException error)
                {
                    return FailHResult("Audio capture", error.ErrorCode);
                }
                finally
                {
                    if (captureClient != null && Marshal.IsComObject(captureClient))
                    {
                        Marshal.FinalReleaseComObject(captureClient);
                    }
                    if (audioClient != null && Marshal.IsComObject(audioClient))
                    {
                        Marshal.FinalReleaseComObject(audioClient);
                    }
                    Marshal.FreeCoTaskMem(formatPointer);
                }
            }
        }
        catch (Exception error)
        {
            return Fail(error.Message);
        }
        finally
        {
            target.Dispose();
            CoUninitialize();
        }
    }

    private static void MonitorStreamControl()
    {
        try
        {
            string command;
            while ((command = Console.In.ReadLine()) != null)
            {
                if (string.Equals(command.Trim(), "STOP", StringComparison.OrdinalIgnoreCase)) break;
            }
        }
        catch (IOException)
        {
        }
        stopRequested = true;
    }

    private static void DrainPackets(
        IAudioCaptureClient captureClient,
        BinaryWriter writer,
        ushort blockAlign,
        ref ulong sequence,
        ref ulong startFrame,
        ref long capturedBytes,
        ref int discontinuities,
        ref bool outputClosed)
    {
        uint nextPacketFrames;
        CheckHResult("Audio packet size", captureClient.GetNextPacketSize(out nextPacketFrames));
        while (nextPacketFrames > 0)
        {
            IntPtr data;
            uint frames;
            uint flags;
            ulong devicePosition;
            ulong performanceCounterPosition;
            CheckHResult("Audio buffer", captureClient.GetBuffer(
                out data,
                out frames,
                out flags,
                out devicePosition,
                out performanceCounterPosition));
            try
            {
                int byteCount = checked((int)(frames * blockAlign));
                byte[] bytes = new byte[byteCount];
                if ((flags & AudioClientBufferFlagsSilent) == 0 && data != IntPtr.Zero)
                {
                    Marshal.Copy(data, bytes, 0, byteCount);
                }
                if ((flags & AudioClientBufferFlagsDataDiscontinuity) != 0) discontinuities++;
                try
                {
                    WriteStreamHeader(writer, 2, (uint)bytes.Length, sequence, startFrame, flags, 0, frames);
                    writer.Write(bytes);
                    writer.Flush();
                    sequence++;
                    startFrame += frames;
                    capturedBytes += byteCount;
                }
                catch (IOException)
                {
                    outputClosed = true;
                    stopRequested = true;
                }
            }
            finally
            {
                CheckHResult("Audio buffer release", captureClient.ReleaseBuffer(frames));
            }
            CheckHResult("Audio packet size", captureClient.GetNextPacketSize(out nextPacketFrames));
        }
    }

    private static void WriteStreamStart(BinaryWriter writer, uint processId, bool include, WaveFormat format)
    {
        WriteStreamHeader(writer, 1, 16, 0, 0, include ? 1u : 2u, 0, processId);
        writer.Write(format.SamplesPerSecond);
        writer.Write(format.Channels);
        writer.Write(format.BitsPerSample);
        writer.Write(format.BlockAlign);
        writer.Write((ushort)0);
        writer.Write(format.AverageBytesPerSecond);
        writer.Flush();
    }

    private static void WriteStreamEnd(
        BinaryWriter writer,
        ulong sequence,
        ulong startFrame,
        int discontinuities,
        bool targetExited,
        long capturedBytes)
    {
        WriteStreamHeader(
            writer,
            3,
            0,
            sequence,
            startFrame,
            (uint)discontinuities,
            targetExited ? 2u : 1u,
            (ulong)capturedBytes);
    }

    private static void WriteStreamHeader(
        BinaryWriter writer,
        ushort type,
        uint payloadBytes,
        ulong sequence,
        ulong startFrame,
        uint flags,
        uint reason,
        ulong counter)
    {
        writer.Write(StreamMagic);
        writer.Write(StreamVersion);
        writer.Write(type);
        writer.Write(StreamHeaderBytes);
        writer.Write(payloadBytes);
        writer.Write(sequence);
        writer.Write(startFrame);
        writer.Write(flags);
        writer.Write(reason);
        writer.Write(counter);
    }

    private static void CheckHResult(string operation, int result)
    {
        if (result < 0) throw new COMException(operation, result);
    }

    private static int FailHResult(string operation, int result)
    {
        return Fail(string.Format("{0} failed with HRESULT 0x{1:X8}.", operation, result));
    }

    private static int Fail(string message)
    {
        Console.Error.WriteLine("error={0}", message);
        return 1;
    }



    [StructLayout(LayoutKind.Sequential)]
    private struct AudioClientActivationParams
    {
        public int ActivationType;
        public uint TargetProcessId;
        public int ProcessLoopbackMode;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Blob
    {
        public uint Size;
        public IntPtr Data;

        public Blob(uint size, IntPtr data)
        {
            Size = size;
            Data = data;
        }
    }

    [StructLayout(LayoutKind.Explicit, Size = 24)]
    private struct PropVariant
    {
        [FieldOffset(0)]
        public ushort VariantType;

        [FieldOffset(8)]
        public Blob Blob;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 2)]
    private struct WaveFormat
    {
        public ushort FormatTag;
        public ushort Channels;
        public uint SamplesPerSecond;
        public uint AverageBytesPerSecond;
        public ushort BlockAlign;
        public ushort BitsPerSample;
        public ushort ExtraSize;

        public static WaveFormat CreatePcm(uint sampleRate, ushort channels, ushort bitsPerSample)
        {
            WaveFormat result = new WaveFormat();
            result.FormatTag = WaveFormatPcm;
            result.Channels = channels;
            result.SamplesPerSecond = sampleRate;
            result.BitsPerSample = bitsPerSample;
            result.BlockAlign = (ushort)(channels * bitsPerSample / 8);
            result.AverageBytesPerSecond = sampleRate * result.BlockAlign;
            result.ExtraSize = 0;
            return result;
        }
    }

    [ComVisible(true)]
    [ClassInterface(ClassInterfaceType.None)]
    public sealed class CompletionHandler : IActivateAudioInterfaceCompletionHandler, IAgileObject
    {
        private readonly EventWaitHandle completed;

        public CompletionHandler(EventWaitHandle completedEvent)
        {
            completed = completedEvent;
            Result = unchecked((int)0x8000FFFF);
        }

        public int Result { get; private set; }
        public object AudioClient { get; private set; }

        public int ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation)
        {
            try
            {
                int activationResult;
                object audioClient;
                int operationResult = operation.GetActivateResult(out activationResult, out audioClient);
                Result = operationResult < 0 ? operationResult : activationResult;
                AudioClient = audioClient;
            }
            catch (Exception error)
            {
                Result = Marshal.GetHRForException(error);
            }
            finally
            {
                completed.Set();
            }
            return 0;
        }
    }

    [ComImport]
    [Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IActivateAudioInterfaceAsyncOperation
    {
        [PreserveSig]
        int GetActivateResult(out int activateResult, [MarshalAs(UnmanagedType.IUnknown)] out object activatedInterface);
    }

    [ComVisible(true)]
    [Guid("41D949AB-9862-444A-80F6-C261334DA5EB")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IActivateAudioInterfaceCompletionHandler
    {
        [PreserveSig]
        int ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation);
    }

    [ComVisible(true)]
    [Guid("94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAgileObject
    {
    }

    [ComImport]
    [Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioClient
    {
        [PreserveSig]
        int Initialize(int shareMode, uint streamFlags, long bufferDuration, long periodicity, IntPtr format, ref Guid audioSessionGuid);
        [PreserveSig]
        int GetBufferSize(out uint bufferFrameCount);
        [PreserveSig]
        int GetStreamLatency(out long latency);
        [PreserveSig]
        int GetCurrentPadding(out uint currentPaddingFrames);
        [PreserveSig]
        int IsFormatSupported(int shareMode, IntPtr format, out IntPtr closestMatch);
        [PreserveSig]
        int GetMixFormat(out IntPtr deviceFormat);
        [PreserveSig]
        int GetDevicePeriod(out long defaultDevicePeriod, out long minimumDevicePeriod);
        [PreserveSig]
        int Start();
        [PreserveSig]
        int Stop();
        [PreserveSig]
        int Reset();
        [PreserveSig]
        int SetEventHandle(IntPtr eventHandle);
        [PreserveSig]
        int GetService(ref Guid interfaceId, [MarshalAs(UnmanagedType.IUnknown)] out object service);
    }

    [ComImport]
    [Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioCaptureClient
    {
        [PreserveSig]
        int GetBuffer(out IntPtr data, out uint framesToRead, out uint flags, out ulong devicePosition, out ulong performanceCounterPosition);
        [PreserveSig]
        int ReleaseBuffer(uint framesRead);
        [PreserveSig]
        int GetNextPacketSize(out uint nextPacketSize);
    }

    [DllImport("Mmdevapi.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    private static extern int ActivateAudioInterfaceAsync(
        string deviceInterfacePath,
        ref Guid interfaceId,
        ref PropVariant activationParams,
        IntPtr completionHandler,
        out IntPtr activationOperation);

    [DllImport("ole32.dll")]
    private static extern int CoInitializeEx(IntPtr reserved, uint concurrencyModel);

    [DllImport("ole32.dll")]
    private static extern void CoUninitialize();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr windowHandle, out uint processId);

}
