import React from 'react'
import { PageLayout } from '../components/PageLayout.jsx'
import { PixelCard } from '../components/PixelCard.jsx'
import { PixelButton } from '../components/PixelButton.jsx'
import { StepBar } from '../components/StepBar.jsx'
import { PixelSelect } from '../components/PixelSelect.jsx'
import { PixelInput } from '../components/PixelInput.jsx'
import { PixelToast } from '../components/PixelToast.jsx'
import { PixelRadio } from '../components/PixelRadio.jsx'
import { mediaAssets } from '../mediaAssets.js'
import { ResetArmButton } from '../components/ResetArmButton.jsx'
import { ConnectionStatusLabel } from '../components/ConnectionStatusLabel.jsx'
import './TestToolPageView.css'

const steps = [
  { id: 'step-1', status: 'done', position: 'first', label: '', title: 'INSTALL' },
  { id: 'step-2', status: 'active', position: 'middle', label: '', title: 'TEST' },
  { id: 'step-3', status: 'pending_3', position: 'middle', label: '', title: 'ASSEMBLY' },
  { id: 'step-4', status: 'pending_4', position: 'last', label: '', title: 'EXECUTE' },
]

const toolOptions = [
  { value: 'Flange', label: 'Flange' },
  { value: 'Tool 1', label: 'Tool A' },
]

const hintOptions = [
  { value: 'A', label: 'A. The target position has changed' },
  { value: 'B', label: 'B. The program execution has changed' },
  {
    value: 'C',
    label: 'C. The reference point used to align with the target has changed',
  },
]

function HintModal({
  selectedOption,
  onSelectOption,
  onClose,
  onConfirm,
  showWrongAnswerToast,
}) {
  return (
    <div
      className="testtool-hint-overlay fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="testtool-hint-modal pixel-card soft-grid p-10"
      >
        {showWrongAnswerToast ? (
          <div
            className="testtool-hint-wrong-toast px text-[12px]"
            role="status"
          >
            Wrong answer
          </div>
        ) : null}
        <div className="mb-8">
          <div
            className="testtool-hint-alert px text-[18px] mb-6 flex items-center"
          >
            <span className="testtool-hint-icon">
              💡
            </span>
            Collision occurred! Check the tool before you run.
          </div>

          <div className="flex justify-between items-start gap-8">
            <div className="flex-1">
              <div
                className="testtool-hint-copy text-[20px] flex flex-col items-center gap-2 text-center"
              >
                <div>If the tool in the program doesn&apos;t match the real one</div>
                <div className="testtool-hint-arrow px">
                  ↓
                </div>
                <div>The robot will use the wrong TCP while working</div>
                <div className="testtool-hint-arrow px">
                  ↓
                </div>
                <div>
                  This can lead to collisions or missed targets during execution.
                </div>
              </div>
            </div>

            <div
              className="testtool-hint-illustration pixel-card soft-grid"
            >
              <div className="flex flex-col w-full h-full">
                <div className="flex-1 overflow-hidden flex items-center justify-center mb-2">
                  <img
                    className="testtool-hint-image"
                    src={mediaAssets.toolTestHintIllustration}
                    alt="Eating with the chopsticks"
                  />
                </div>
                <div className="testtool-hint-caption text-[13px]">
                  You practiced eating with long chopsticks. When it&apos;s time to
                  eat, you forget you&apos;re holding them and try to grab food by hand
                  - the chopsticks crash straight into the plate.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="testtool-hint-divider mb-4" />
          <div className="testtool-hint-question text-[15px] mb-4">
            <span className="testtool-hint-question-icon">
              🤔
            </span>
            Question: Why does a mismatch between the tool configuration and the
            physical tool lead to collisions?
          </div>
          <div className="space-y-3 text-[14px]">
            {hintOptions.map((option) => (
              <PixelRadio
                key={option.value}
                label={option.label}
                checked={selectedOption === option.value}
                onChange={() => onSelectOption(option.value)}
              />
            ))}
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <PixelButton
            variant="white"
            className="px-8 py-4 text-[12px]"
            onClick={onClose}
          >
            Close
          </PixelButton>
          <PixelButton
            variant="magenta"
            className="flex-1 py-4 text-[12px]"
            onClick={onConfirm}
          >
            Confirm
          </PixelButton>
        </div>
      </div>
    </div>
  )
}

export function TestToolPageView({
  coords,
  connectionInfo,
  isRunning,
  hasError,
  isSuccess,
  showToast,
  showHintWrongToast,
  showHintModal,
  selectedOption,
  selectedTool,
  payloadValue,
  onSelectTool,
  onSelectOption,
  onPrimaryAction,
  onOpenHintModal,
  onCloseHintModal,
  onConfirmHintModal,
}) {
  const primaryLabel = isSuccess ? 'Start Game !' : hasError ? 'TEST AGAIN' : 'TEST'

  return (
    <PageLayout>
      <div className="flex items-center justify-between shrink-0 mb-10">
        <div className="testtool-page-title px text-[24px]">
          Lion Model Assembly Game
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatusLabel text={connectionInfo} />
          <ResetArmButton />
          <div className="swatch testtool-swatch-purple" />
          <div className="swatch testtool-swatch-orange" />
          <div className="swatch testtool-swatch-magenta" />
        </div>
      </div>

      <StepBar steps={steps} />

      <PixelToast
        open={hasError && showToast}
        icon="⚠"
        message="Collision occurred! Try to solve it"
      />

      <div className="grid max-lg:grid-cols-1 max-lg:[grid-auto-rows:max-content] max-lg:flex-none gap-8 lg:grid-cols-[4fr_3fr] lg:flex-1 lg:min-h-0">
        <PixelCard
          padding="p-6"
          className="flex min-h-0 max-h-full flex-col overflow-hidden max-lg:max-h-none"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-6 pb-6 max-lg:min-h-min max-lg:flex-none max-lg:overflow-visible">
            <div className="testtool-intro px text-[13px]">
              Check your tool, pick up the teddy bear, and complete the tool test to
              begin the game.
            </div>

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <div className="px text-[12px] shrink-0">TOOL</div>
                  <PixelSelect
                    className="flex-1 min-w-0"
                    value={selectedTool}
                    onChange={onSelectTool}
                    options={toolOptions}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="px text-[12px] shrink-0">PAYLOAD</div>
                  <PixelInput
                    value={payloadValue}
                    className="flex-1 min-w-0"
                    readOnly
                  />
                </div>
              </div>

              <div className="mt-1 flex items-center gap-3">
                <div className="px text-[12px] shrink-0">TCP</div>
                <div className="grid grid-cols-4 gap-6 flex-1 min-w-0">
                  {[
                    { axis: 'X', value: coords.x },
                    { axis: 'Y', value: coords.y },
                    { axis: 'Z', value: coords.z },
                    { axis: 'Rx', value: coords.rx },
                  ].map(({ axis, value }) => (
                    <div key={axis} className="flex items-center gap-2 min-w-0">
                      <div className="px text-[12px]">{axis}</div>
                      <PixelInput
                        className="flex-1 min-w-0"
                        value={value}
                        readOnly
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="testtool-placeholder-card mt-4 pixel-card soft-grid">
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="px text-[12px] mb-2">GIF PLACEHOLDER</div>
                  <div className="testtool-placeholder-caption text-[10px]">
                    Grab the teddy bear · Highlight the TCP
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 mt-6 w-full">
            {isRunning ? (
              <div className="testtool-running-shell w-full">
                <div className="running-bar testtool-running-fill" />
                <span className="testtool-running-label px text-[13px]">
                  Running...
                </span>
              </div>
            ) : (
              <PixelButton
                variant="magenta"
                className="w-full py-4 text-[12px]"
                onClick={onPrimaryAction}
                icon={isSuccess ? '🎉' : undefined}
              >
                {primaryLabel}
              </PixelButton>
            )}
          </div>
        </PixelCard>

        <PixelCard
          title="3D ROBOT MODEL"
          titleColor="var(--orange)"
          className="flex min-h-0 max-h-full flex-col overflow-hidden max-lg:max-h-none"
        >
          <div className="testtool-model-stage flex min-h-0 flex-1 flex-col max-lg:flex-none">
            <div className="testtool-model-cover-wrap max-lg:min-h-[min(52vh,340px)]">
              <img
                src={mediaAssets.robot3dPreview}
                alt="Robot arm hardware preview"
                className="testtool-model-cover-img"
              />
              {hasError && (
                <button
                  className="testtool-hint-trigger"
                  type="button"
                  onClick={onOpenHintModal}
                >
                  <span className="testtool-hint-trigger-icon">
                    💡
                  </span>
                </button>
              )}
            </div>
          </div>
        </PixelCard>
      </div>

      {showHintModal && (
        <HintModal
          selectedOption={selectedOption}
          onSelectOption={onSelectOption}
          onClose={onCloseHintModal}
          onConfirm={onConfirmHintModal}
          showWrongAnswerToast={showHintWrongToast}
        />
      )}
    </PageLayout>
  )
}
