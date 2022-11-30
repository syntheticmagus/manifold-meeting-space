export class LocalAttendee {
    private _audioStream: MediaStream;
    public get AudioStream() {
        return this._audioStream;
    }

    private constructor(audioStream: MediaStream) {
        this._audioStream = audioStream;
    }

    public static async CreateAsync(): Promise<LocalAttendee> {
        const audio = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        return new LocalAttendee(audio);
    }

    public dispose() {
        this._audioStream.getTracks().forEach((track) => {
            track.stop();
        });
    }
}