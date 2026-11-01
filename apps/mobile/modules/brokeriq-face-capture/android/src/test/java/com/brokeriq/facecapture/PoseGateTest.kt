package com.brokeriq.facecapture

import org.junit.Assert.*
import org.junit.Test

class PoseGateTest {
  private fun frame(gate: PoseGate, at: Long, yaw: Float = 0f, eyes: Float? = .9f, count: Int = 1, pose: Pose = Pose.STRAIGHT) =
    gate.observe(pose, count, yaw, 0f, eyes, eyes, true, at)
  private fun blink(gate: PoseGate) { frame(gate, 1000); frame(gate, 1100, eyes = .1f); frame(gate, 1200) }

  @Test fun requiresOpenClosedOpenBlink() {
    val gate = PoseGate()
    for (at in 1000L..2500L step 100) assertFalse(frame(gate, at))
    assertFalse(gate.blinkComplete)
    val good = PoseGate(); blink(good)
    assertTrue(good.blinkComplete)
    assertFalse(good.allowed(1200))
    for (at in 1300L..1900L step 100) assertFalse(frame(good, at))
    assertTrue(frame(good, 2000))
  }
  @Test fun aClosedEyeOrMissingClassificationCannotCountAsBlink() {
    val gate = PoseGate()
    frame(gate, 1000, eyes = .1f); frame(gate, 1100); frame(gate, 1200, eyes = null); frame(gate, 2100)
    assertFalse(gate.blinkComplete); assertFalse(gate.allowed(2100))
  }
  @Test fun multipleFacesInterruptAnIncompleteBlink() {
    val gate = PoseGate(); frame(gate, 1000); frame(gate, 1100, eyes = .1f); frame(gate, 1200, count = 2); frame(gate, 1300)
    assertFalse(gate.blinkComplete)
  }
  @Test fun staleFramesAndLostFaceDisableCaptureImmediately() {
    val gate = PoseGate(); blink(gate); for (at in 1300L..2000L step 100) frame(gate, at)
    assertTrue(gate.allowed(2100)); assertFalse(gate.allowed(2400))
    frame(gate, 2200, count = 0); assertFalse(gate.allowed(2200))
  }
  @Test fun turningToTheWrongSideCannotUnlockRequestedPose() {
    val gate = PoseGate(); blink(gate)
    for (at in 1300L..2500L step 100) assertFalse(frame(gate, at, yaw = -30f, pose = Pose.LEFT))
    for (at in 2600L..3300L step 100) assertFalse(frame(gate, at, yaw = 30f, pose = Pose.LEFT))
    assertTrue(frame(gate, 3400, yaw = 30f, pose = Pose.LEFT))
  }
  @Test fun backgroundResetRequiresANewBlink() {
    val gate = PoseGate(); blink(gate); gate.reset(requireBlink = true)
    assertFalse(gate.blinkComplete); assertFalse(frame(gate, 3000)); assertFalse(gate.allowed(3000))
  }
  @Test fun nonFiniteAnglesTiltAndSmallOrCroppedFacesAreRejected() {
    assertFalse(PoseGate.poseMatches(Pose.STRAIGHT, Float.NaN, 0f))
    assertFalse(PoseGate.poseMatches(Pose.LEFT, Float.POSITIVE_INFINITY, 0f))
    assertFalse(PoseGate.poseMatches(Pose.STRAIGHT, 0f, 16f))
    val gate = PoseGate(); blink(gate)
    assertFalse(gate.observe(Pose.STRAIGHT, 1, 0f, 0f, .9f, .9f, false, 2000))
  }
  @Test fun aGapInAnalyzedFramesStartsANewHoldPeriod() {
    val gate = PoseGate(); blink(gate)
    for (at in 1300L..2000L step 100) frame(gate, at)
    assertTrue(gate.allowed(2000))
    assertFalse(frame(gate, 3000))
    for (at in 3100L..3700L step 100) assertFalse(frame(gate, at))
    assertTrue(frame(gate, 3800))
  }
  @Test fun switchingPoseStartsAnotherHoldPeriod() {
    val gate = PoseGate(); blink(gate); for (at in 1300L..2000L step 100) frame(gate, at)
    assertTrue(gate.allowed(2100))
    assertFalse(frame(gate, 2200, yaw = -30f, pose = Pose.RIGHT))
    assertFalse(gate.allowed(2200))
  }
}
