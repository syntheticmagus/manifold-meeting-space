export class LocalAttendee {
    private _audioStream?: MediaStream;
    public get AudioStream(): MediaStream {
        return this._audioStream!;
    }

    public async startAudioStreamAsync(): Promise<void> {
        this._audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });
    }

    public stopAudioStream(): void {
        this._audioStream?.getTracks().forEach((track) => {
            track.stop();
        });
        this._audioStream = undefined;
    }

    public dispose() {
        this.stopAudioStream();
    }
}