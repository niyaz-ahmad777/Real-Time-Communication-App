export const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

export async function getLocalStream() {
  return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
}

export async function getScreenStream() {
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
}
