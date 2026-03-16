import React from 'react'
import { PageLayout } from '../components/PageLayout.jsx'
import { PixelCard } from '../components/PixelCard.jsx'
import { PixelButton } from '../components/PixelButton.jsx'
import { PixelToast } from '../components/PixelToast.jsx'
import { PixelRadio } from '../components/PixelRadio.jsx'
import { StepBar } from '../components/StepBar.jsx'
import { PixelSelect } from '../components/PixelSelect.jsx'
import { TrajectoryPointCard } from '../components/TrajectoryPointCard.jsx'
import './AssemblyModelPageView.css'

const steps = [
  { id: 'step-1', status: 'done', position: 'first', label: '', title: 'INSTALL' },
  { id: 'step-2', status: 'done', position: 'middle', label: '', title: 'TEST' },
  { id: 'step-3', status: 'active', position: 'middle', label: '', title: 'ASSEMBLY' },
  { id: 'step-4', status: 'pending_4', position: 'last', label: '', title: 'EXECUTE' },
]

function TelemetryBadge({ label, value }) {
  return (
    <div className="assembly-badge px-3 py-2 text-[11px]">
      <span className="px">{label}</span>: {value}
    </div>
  )
}

function JogAxisControl({ label, onNegative, onPositive }) {
  return (
    <div className="assembly-jog-control flex items-center">
      <button
        type="button"
        onClick={onNegative}
        className="w-10 h-9 text-[18px] flex items-center justify-center"
      >
        ‹
      </button>
      <div className="flex-1 text-center px text-[12px]">{label}</div>
      <button
        type="button"
        onClick={onPositive}
        className="w-10 h-9 text-[18px] flex items-center justify-center"
      >
        ›
      </button>
    </div>
  )
}

function CollisionHintModal({
  hintType,
  hintStep,
  selectedOption,
  onSelectOption,
  onClose,
  onConfirm,
}) {
  const isDirectionStepOne = hintType === 'direction' && hintStep === 1
  const isDirectionStepTwo = hintType === 'direction' && hintStep === 2
  const isSingularityHint = hintType === 'singularity'
  const expectedAnswer = isSingularityHint ? 'C' : isDirectionStepTwo ? 'A' : 'B'
  const canConfirm = selectedOption === expectedAnswer
  const primaryLabel = isDirectionStepOne ? 'NEXT' : 'Confirm'
  const optionList = isSingularityHint
    ? [
        { value: 'A', label: 'A. The program crashed' },
        { value: 'B', label: 'B. The robot lost power' },
        {
          value: 'C',
          label: 'C. The robot lost motion capability in certain directions',
        },
      ]
    : hintType === 'waypoint'
      ? [
          { value: 'A', label: 'A. It replays the demonstrated path exactly' },
          {
            value: 'B',
            label: 'B. The TCP moves from one recorded point to the next smoothly, in order',
          },
          {
            value: 'C',
            label: 'C. The TCP automatically moves from the grab point to the drop point',
          },
        ]
      : isDirectionStepOne
        ? [
            { value: 'A', label: 'A. The offset value was wrong' },
            { value: 'B', label: 'B. The reference frame used for the offset was different' },
            { value: 'C', label: 'C. The robot speed was too high' },
          ]
        : [
            {
              value: 'A',
              label: 'A. Pausing may fail if communication is interrupted.',
            },
            { value: 'B', label: 'B. Pausing is slower' },
            { value: 'C', label: 'C. Pausing resets the robot' },
          ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
    >
      <div
        className="pixel-card soft-grid p-10"
        style={{
          background: 'var(--panel)',
          maxWidth: '1120px',
          width: 'calc(100% - 64px)',
          maxHeight: '82vh',
          overflowY: 'auto',
        }}
      >
        {hintType === 'waypoint' && (
          <>
            <div
              className="px text-[18px] mb-6 flex items-center"
              style={{ color: '#FF3B3B' }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'translateY(-2px) scale(1.5)',
                  transformOrigin: 'center',
                  marginRight: '10px',
                }}
              >
                💡
              </span>
              Collision occurred! Try to add more waypoints to avoid colliding with
              objects
            </div>

            <div className="flex justify-between items-start gap-8 mb-8">
              <div className="flex-1 text-center text-[20px]">
                <div>The TCP moves smoothly from one recorded point to the next</div>
                <div className="text-[24px]">↓</div>
                <div>
                  With too few waypoints, the trajectory cannot avoid objects between
                  the points
                </div>
                <div className="text-[24px]">↓</div>
                <div>collisions happen</div>
              </div>

              <div
                className="pixel-card soft-grid p-6"
                style={{
                  width: '440px',
                  height: '320px',
                  background: '#F0F0F0',
                }}
              >
                <div className="h-full flex flex-col justify-center">
                  <div className="text-center text-[28px] mb-4">Illustration</div>
                  <div className="text-center text-[28px] mb-6">
                    Driving on the road with a big rock
                  </div>
                  <div
                    className="text-[22px]"
                    style={{ color: 'var(--muted)', lineHeight: 1.25 }}
                  >
                    Just like driving: when there&apos;s a big rock on the road, you
                    don&apos;t drive straight into it - you adjust your route and go
                    around it.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {isDirectionStepOne && (
          <>
            <div className="px text-[18px] mb-6 flex items-center">
              💡 Wrong Direction ! You need to stop the robot immediately !
            </div>
            <div className="flex justify-between items-start gap-8 mb-8">
              <div className="flex-1 text-center text-[20px] leading-[1.35]">
                <div>
                  Offsets are relative to the &quot;previous point&quot;, so a
                  relative frame is required
                </div>
                <div className="text-[24px]">↓</div>
                <div>Using the base frame requires cumulative calculation</div>
                <div className="text-[24px]">↓</div>
                <div>
                  If the values don&apos;t match the reference frame, the point ends up
                  in a completely different location.
                </div>
              </div>
              <div
                className="pixel-card soft-grid p-6"
                style={{ width: '440px', minHeight: '300px', background: '#D5D5D5' }}
              >
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="text-[28px] mb-3">Illustration</div>
                  <div className="text-[26px] mb-5">Two jogging styles</div>
                  <div className="text-[22px] leading-[1.25]" style={{ color: '#767676' }}>
                    &quot;Place the cup at center&quot; and &quot;move the cup forward by 10
                    cm&quot; can end at the same point, but the frame used for motion is
                    different.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {isDirectionStepTwo && (
          <>
            <div className="px text-[18px] mb-6 flex items-center">
              💡 What should you do when the robot moves quickly in an unexpected
              direction?
            </div>
            <div className="flex justify-between items-start gap-8 mb-8">
              <div className="flex-1 text-center text-[20px] leading-[1.35]">
                <div>Press the E-stop button immediately</div>
                <div className="text-[24px]">↓</div>
                <div>The robot will instantly cut power and stop moving</div>
                <div className="text-[24px]">↓</div>
                <div>
                  After fixing the issue, restart the robot and manually move it
                  away from the abnormal position.
                </div>
              </div>
              <div
                className="pixel-card soft-grid p-6"
                style={{ width: '440px', minHeight: '300px', background: '#D5D5D5' }}
              >
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="text-[28px] mb-3">Illustration</div>
                  <div className="text-[26px] mb-5">E-STOP button</div>
                  <div className="text-[22px] leading-[1.25]" style={{ color: '#767676' }}>
                    When risk grows quickly, cutting power is the safest immediate
                    action because it removes robot actuation instantly.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {isSingularityHint && (
          <>
            <div className="px text-[18px] mb-6 flex items-center">
              💡 The robot has reached a singularity. It can&apos;t move in this
              configuration.
            </div>
            <div className="flex justify-between items-start gap-8 mb-8">
              <div className="flex-1 text-center text-[20px] leading-[1.35]">
                <div>TCP移动是靠机械臂各个关节转动实现的</div>
                <div className="text-[24px]">↓</div>
                <div>在该构型下，某个方向上的TCP微小位移需要“无限大的关节速度”</div>
                <div className="text-[24px]">↓</div>
                <div>但机械臂的每个关节都有角度限制和速度限制</div>
                <div className="text-[24px]">↓</div>
                <div>此时机械臂会失去某个方向的运动能力</div>
                <div className="text-[15px] mt-4" style={{ color: '#777' }}>
                  Think of it this way: <br />
                  When your arm is fully stretched, you can only swing it left and
                  right. This happens because physical limitations restrict its
                  reach, causing a loss of movement in that direction.
                </div>
              </div>
              <div
                className="pixel-card soft-grid p-6 assembly-singularity-illustration"
                style={{ width: '440px', minHeight: '300px', background: '#D5D5D5' }}
              >
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="text-[28px] mb-3">Illustration</div>
                  <div className="text-[26px] mb-5">伸直的胳膊</div>
                </div>
              </div>
            </div>
          </>
        )}

        <div
          className="mb-6"
          style={{
            height: '2px',
            background:
              'repeating-linear-gradient(90deg, var(--ink) 0 8px, transparent 8px 12px)',
            boxShadow: '0 3px 0 var(--shadow)',
          }}
        />

        <div className="text-[24px] mb-4">
          {hintType === 'waypoint' &&
            '🤔 Question: How does the robot follow a planned trajectory during execution?'}
          {isDirectionStepOne &&
            '🤔 Question: Why did the point move to a completely different position?'}
          {isDirectionStepTwo &&
            '🤔 Question: Why is pressing E-stop necessary instead of just pausing the program?'}
          {isSingularityHint &&
            '🤔 Question: Why does the robot stop moving at a singularity?'}
        </div>

        <div className="space-y-3 text-[14px]">
          {optionList.map((option) => (
            <PixelRadio
              key={option.value}
              label={option.label}
              checked={selectedOption === option.value}
              onChange={() => onSelectOption(option.value)}
            />
          ))}
        </div>

        <div className="mt-8 flex gap-4">
          {!isDirectionStepTwo && (
            <PixelButton
              variant="white"
              className="px-8 py-4 text-[12px]"
              onClick={onClose}
            >
              Close
            </PixelButton>
          )}
          <PixelButton
            variant="magenta"
            className={`flex-1 py-4 text-[12px] ${
              !canConfirm ? 'opacity-40 pointer-events-none' : ''
            }`}
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {primaryLabel}
          </PixelButton>
        </div>
      </div>
    </div>
  )
}

export function AssemblyModelPageView({
  stage,
  mode,
  grab,
  grabFrame,
  drop,
  dropFrame,
  waypoints,
  frameOptions,
  jogFrameOptions,
  canConfirm,
  isAssemblyRunning,
  hasCollision,
  showCollisionToast,
  showCollisionHintModal,
  selectedCollisionOption,
  collisionHintType,
  collisionHintStep,
  showRelativeHintInfo,
  showSuccessModal,
  successPrimaryLabel,
  jogFrame,
  hasSingularityWarning,
  hardwareStatusLabel,
  temperatureLabel,
  onToggleMode,
  onConfirmTest,
  onNextBlock,
  onSuccessPrimaryAction,
  onOpenCollisionHint,
  onCloseCollisionHint,
  onSelectCollisionOption,
  onConfirmCollisionHint,
  onAddWaypoint,
  onRemoveWaypoint,
  onChangeGrabAxis,
  onChangeGrabFrame,
  onChangeDropAxis,
  onChangeDropFrame,
  onChangeWaypointAxis,
  onChangeWaypointFrame,
  onChangeJogFrame,
  onJogMove,
  onRecordGrab,
  onRecordDrop,
  onRecordWaypoint,
}) {
  const showJoggingPanel = stage !== 'first-block'
  const isThirdBlock = stage === 'third-block'
  const confirmButtonLabel = hasSingularityWarning ? 'Reset the robot' : 'Confirm & Test'

  return (
    <PageLayout>
      <div className="flex items-center justify-between shrink-0 mb-10">
        <div className="assembly-page-title px text-[24px]">
          Lion Model Assembly Game
        </div>
        <div className="flex gap-3">
          <div className="swatch" style={{ background: 'var(--bgPurple)' }} />
          <div className="swatch" style={{ background: 'var(--orange)' }} />
          <div className="swatch" style={{ background: 'var(--magenta)' }} />
        </div>
      </div>

      <StepBar steps={steps} />

      <PixelToast
        open={showCollisionToast}
        icon="⚠"
        message="Collision occurred! Try to solve it"
      />

      <div className="grid lg:grid-cols-2 gap-8 flex-1 min-h-0 max-lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
        <PixelCard
          padding="p-6"
          className="min-h-0 max-h-full flex flex-col overflow-hidden"
        >
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pr-6 pb-6">
            {showJoggingPanel ? (
              <div className="assembly-intro text-[13px]">
                {isThirdBlock
                  ? 'Use any method you prefer to assemble the third block.'
                  : 'Use Jogging to control the robot and assemble the second block.'}
              </div>
            ) : (
              <div className="assembly-intro text-[13px]">
                Use the mini robot to control the robot arm to pick and assemble the
                first block.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <TelemetryBadge label="Source" value="Mock telemetry" />
              <TelemetryBadge label="Status" value={hardwareStatusLabel} />
              <TelemetryBadge label="Temp" value={temperatureLabel} />
            </div>

            {showJoggingPanel ? (
              <div
                className={`pixel-card soft-grid mt-2 p-3 ${
                  hasSingularityWarning ? 'assembly-danger-shell' : ''
                }`}
                style={{ background: 'var(--panel)' }}
              >
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="assembly-ink text-[22px]">
                    Jogging
                  </div>
                  <PixelSelect
                    className="w-[220px]"
                    value={jogFrame}
                    onChange={onChangeJogFrame}
                    options={jogFrameOptions}
                    variant="flat"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <JogAxisControl
                    label="X"
                    onNegative={() => onJogMove('x', 'negative')}
                    onPositive={() => onJogMove('x', 'positive')}
                  />
                  <JogAxisControl
                    label="Z"
                    onNegative={() => onJogMove('z', 'negative')}
                    onPositive={() => onJogMove('z', 'positive')}
                  />
                  <JogAxisControl
                    label="Y"
                    onNegative={() => onJogMove('y', 'negative')}
                    onPositive={() => onJogMove('y', 'positive')}
                  />
                  <JogAxisControl
                    label="Rx"
                    onNegative={() => onJogMove('rx', 'negative')}
                    onPositive={() => onJogMove('rx', 'positive')}
                  />
                </div>
              </div>
            ) : (
              <div
                className="assembly-placeholder pixel-card soft-grid mt-2"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="px text-[12px] mb-2">GIF PLACEHOLDER</div>
                    <div className="assembly-muted text-[10px]">
                      How to teleoperate the mini arm
                    </div>
                  </div>
                </div>
              </div>
            )}

            <PixelCard
              padding="p-4"
              className={`mt-4 flex-1 min-h-0 overflow-hidden ${
                hasSingularityWarning ? 'assembly-danger-shell' : ''
              }`}
            >
              <div className={`text-[13px] mb-3 ${hasSingularityWarning ? 'assembly-danger-text' : ''}`}>
                Trajectory Planning
              </div>

              <div
                className={`flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 ${
                  hasSingularityWarning ? 'assembly-danger-shell' : ''
                }`}
              >
                <TrajectoryPointCard
                  accent="magenta"
                  title="Grab Point"
                  point={grab}
                  frameOptions={frameOptions}
                  frameValue={grabFrame}
                  onFrameChange={onChangeGrabFrame}
                  onAxisChange={onChangeGrabAxis}
                  onRecord={onRecordGrab}
                />

                {waypoints.map((waypoint) => (
                  <TrajectoryPointCard
                    key={waypoint.id}
                    accent="orange"
                    title="WayPoint"
                    point={waypoint.point}
                    frameOptions={frameOptions}
                    frameValue={waypoint.frame}
                    onFrameChange={(value) =>
                      onChangeWaypointFrame(waypoint.id, value)
                    }
                    onAxisChange={(axis, value) =>
                      onChangeWaypointAxis(waypoint.id, axis, value)
                    }
                    onRecord={() => onRecordWaypoint(waypoint.id)}
                    onRemove={() => onRemoveWaypoint(waypoint.id)}
                  />
                ))}

                <div className="flex justify-center my-2">
                  <button
                    type="button"
                    onClick={onAddWaypoint}
                    className="w-8 h-8 rounded-full border-2 border-[var(--ink)] flex items-center justify-center text-[18px]"
                    style={{ background: 'var(--panel)' }}
                    aria-label="Add waypoint"
                  >
                    +
                  </button>
                </div>

                <TrajectoryPointCard
                  accent="green"
                  title="Drop Point"
                  point={drop}
                  frameOptions={frameOptions}
                  frameValue={dropFrame}
                  onFrameChange={onChangeDropFrame}
                  onAxisChange={onChangeDropAxis}
                  onRecord={onRecordDrop}
                  bordered={false}
                />
              </div>
            </PixelCard>
          </div>

          <div className="mt-4 flex items-center gap-4">
            {isAssemblyRunning ? (
              <div
                className="assembly-running-shell w-full"
              >
                <div className="running-bar assembly-running-fill" />
                <span className="assembly-running-label px text-[13px]">
                  Running...
                </span>
              </div>
            ) : (
              <>
                <PixelButton
                  variant="white"
                  className="px-8 py-4 text-[12px]"
                  onClick={onToggleMode}
                >
                  {mode === 'pick' ? 'Pick' : 'Drop'}
                </PixelButton>
                <PixelButton
                  variant="magenta"
                  className={`flex-1 py-4 text-[12px] ${
                    !canConfirm ? 'opacity-40 pointer-events-none' : ''
                  }`}
                  disabled={!canConfirm}
                  onClick={onConfirmTest}
                >
                  {confirmButtonLabel}
                </PixelButton>
              </>
            )}
          </div>
        </PixelCard>

        <PixelCard
          title="3D ROBOT MODEL"
          titleColor="var(--orange)"
          className="min-h-0 max-h-full flex flex-col overflow-hidden"
        >
          <div
            className="assembly-model-stage flex-1 min-h-0 overflow-y-auto flex items-center justify-center"
          >
            <div className="relative w-full h-full flex items-center justify-center py-16">
              <div className="text-center">
                <div className="px text-[16px] mb-2">Lion Model</div>
                <div className="assembly-muted px text-[12px]">
                  {isThirdBlock
                    ? 'Install the third building block'
                    : 'Install the first building block'}
                </div>
                {isThirdBlock && (
                  <div className="assembly-third-coordinate mt-5">
                    <div>World</div>
                    <div>Flange</div>
                    <div>TCP</div>
                  </div>
                )}
                {isThirdBlock && hasSingularityWarning && (
                  <div className="assembly-singularity-warning mt-4">
                    You can move the block to avoid the singularity on the trajectory.
                  </div>
                )}
                {showRelativeHintInfo && showJoggingPanel && (
                  <div className="assembly-relative-box mt-5">
                    <div className="assembly-relative-title">
                      Maybe you need add some intermediate waypoint
                    </div>
                    <div className="assembly-relative-subtitle">
                      Highlight the relative offset
                    </div>
                    <div className="assembly-relative-lines">
                      <div>Y: 60mm</div>
                      <div>Z: 20mm</div>
                      <div>Y: 20mm</div>
                    </div>
                    <div className="assembly-relative-note">
                      Add intermediate waypoints and align values with selected
                      reference frame.
                    </div>
                  </div>
                )}
              </div>

              {hasCollision && !isAssemblyRunning && (
                <button
                  type="button"
                  onClick={onOpenCollisionHint}
                  style={{
                    position: 'absolute',
                    right: '24px',
                    bottom: '24px',
                    width: '60px',
                    height: '60px',
                    borderRadius: '9999px',
                    border: '2px solid var(--ink)',
                    boxShadow: '4px 4px 0 var(--shadow)',
                    background: '#FFD5D5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '26px',
                      textShadow: '2px 2px 0 var(--shadow)',
                    }}
                  >
                    💡
                  </span>
                </button>
              )}
            </div>
          </div>
        </PixelCard>
      </div>

      {showSuccessModal && (
        <div
          className="assembly-modal-overlay fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="w-full max-w-xl px-6">
            <div className="text-center">
              <div className="assembly-modal-gif mx-auto mb-6 flex items-center justify-center">
                <img
                  className="assembly-modal-gif-image"
                  src="/placeholders/celebration-gif.gif"
                  alt="Celebration gif"
                />
              </div>
              <div className="assembly-success-text px text-[20px] mb-3">
                Assembly complete!
              </div>
              <div className="assembly-success-text px text-[20px] mb-8">
                NEXT LEVEL UNLOCKED!
              </div>
              <PixelButton
                variant="magenta"
                className="w-full py-5 text-[14px]"
                onClick={onSuccessPrimaryAction ?? onNextBlock}
              >
                {successPrimaryLabel ?? 'Next block'}
              </PixelButton>
            </div>
          </div>
        </div>
      )}

      {showCollisionHintModal && (
        <CollisionHintModal
          hintType={collisionHintType}
          hintStep={collisionHintStep}
          selectedOption={selectedCollisionOption}
          onSelectOption={onSelectCollisionOption}
          onClose={onCloseCollisionHint}
          onConfirm={onConfirmCollisionHint}
        />
      )}
    </PageLayout>
  )
}
