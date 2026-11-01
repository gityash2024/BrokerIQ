package com.brokeriq.facecapture

import kotlin.math.abs

enum class Pose { STRAIGHT, LEFT, RIGHT }

/** Capture quality only; identity/KYC approval always belongs to an authorized human reviewer. */
class PoseGate {
  private var blink = 0
  private var holdStarted = 0L
  private var observedAt = 0L
  private var matching = false
  private var expected = Pose.STRAIGHT

  val blinkComplete get() = blink == 3

  fun reset(requireBlink: Boolean = false) {
    if (requireBlink) blink = 0
    holdStarted = 0L
    observedAt = 0L
    matching = false
  }

  fun observe(pose: Pose, faces: Int, yaw: Float, roll: Float, leftEye: Float?, rightEye: Float?, largeCenteredFace: Boolean, now: Long): Boolean {
    if (pose != expected) { expected = pose; reset() }
    if (now <= observedAt || !yaw.isFinite() || !roll.isFinite() || faces != 1 || !largeCenteredFace || abs(roll) > 15f) {
      reset(requireBlink = !blinkComplete)
      return false
    }
    if (observedAt > 0 && now - observedAt > 300) holdStarted = 0L
    observedAt = now
    if (!blinkComplete && abs(yaw) <= 12f && leftEye != null && rightEye != null && leftEye.isFinite() && rightEye.isFinite()) {
      val open = leftEye > .7f && rightEye > .7f
      val closed = leftEye < .25f && rightEye < .25f
      if (blink == 0 && open) blink = 1
      else if (blink == 1 && closed) blink = 2
      else if (blink == 2 && open) blink = 3
    }
    matching = blinkComplete && poseMatches(pose, yaw, roll)
    if (!matching) holdStarted = 0L
    else if (holdStarted == 0L) holdStarted = now
    return allowed(now)
  }

  fun allowed(now: Long): Boolean = matching && observedAt > 0 && now >= observedAt && now - observedAt <= 300 && holdStarted > 0 && now - holdStarted >= 750

  companion object {
    fun poseMatches(pose: Pose, yaw: Float, roll: Float): Boolean {
      if (!yaw.isFinite() || !roll.isFinite() || abs(roll) > 15f) return false
      return when (pose) {
        Pose.STRAIGHT -> abs(yaw) <= 12f
        Pose.LEFT -> yaw in 22f..50f
        Pose.RIGHT -> yaw in -50f..-22f
      }
    }
  }
}
