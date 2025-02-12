import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Portal, usePortal } from '@gorhom/portal';
import { nanoid } from 'nanoid/non-secure';
import isEqual from 'lodash.isequal';
import BottomSheet from '../bottomSheet';
import { useBottomSheetModalInternal } from '../../hooks';
import { DEFAULT_DISMISS_ON_PAN_DOWN } from './constants';
import type { BottomSheetModalMethods } from '../../types';
import type { BottomSheetModalProps } from './types';

type BottomSheetModal = BottomSheetModalMethods;

const BottomSheetModalComponent = forwardRef<
  BottomSheetModal,
  BottomSheetModalProps
>((props, ref) => {
  const {
    // modal props
    name,
    dismissOnPanDown = DEFAULT_DISMISS_ON_PAN_DOWN,
    onDismiss: _providedOnDismiss,

    // bottom sheet props
    index: _providedIndex = 0,
    snapPoints: _providedSnapPoints,
    onChange: _providedOnChange,
    topInset = 0,
    bottomInset = 0,

    // components
    children,
    ...bottomSheetProps
  } = props;

  //#region state
  const [mount, setMount] = useState(false);
  //#endregion

  //#region hooks
  const { unmount: unmountPortal } = usePortal();
  const {
    containerHeight,
    mountSheet,
    unmountSheet,
    willUnmountSheet,
  } = useBottomSheetModalInternal();
  //#endregion

  //#region refs
  const bottomSheetRef = useRef<BottomSheet>(null);
  const isMinimized = useRef(false);
  const isForcedDismissed = useRef(false);
  const currentIndexRef = useRef(-1);
  const nextIndexRef = useRef(-1);
  //#endregion

  //#region variables
  const key = useMemo(() => name || `bottom-sheet-modal-${nanoid()}`, [name]);
  const index = useMemo(
    () => (dismissOnPanDown ? _providedIndex + 1 : _providedIndex),
    [_providedIndex, dismissOnPanDown]
  );
  const snapPoints = useMemo(
    () =>
      dismissOnPanDown ? [0, ..._providedSnapPoints] : _providedSnapPoints,
    [_providedSnapPoints, dismissOnPanDown]
  );
  const safeContainerHeight = useMemo(
    () => containerHeight - topInset - bottomInset,
    [containerHeight, topInset, bottomInset]
  );
  //#endregion

  //#region callbacks
  const doDismiss = useCallback(() => {
    // reset
    isMinimized.current = false;
    isForcedDismissed.current = false;
    currentIndexRef.current = -1;
    nextIndexRef.current = -1;

    // unmount the sheet and the portal
    unmountSheet(key);
    unmountPortal(key);
    setMount(false);

    // fire the call back
    if (_providedOnDismiss) {
      _providedOnDismiss();
    }
  }, [key, _providedOnDismiss, unmountSheet, unmountPortal]);
  const handleOnChange = useCallback(
    (_index: number) => {
      if (isMinimized.current && !isForcedDismissed.current) {
        return;
      }

      const adjustedIndex = dismissOnPanDown ? _index - 1 : _index;
      currentIndexRef.current = _index;
      nextIndexRef.current = _index;

      if (adjustedIndex >= 0) {
        if (_providedOnChange) {
          _providedOnChange(adjustedIndex);
        }
      } else {
        doDismiss();
      }
    },
    [dismissOnPanDown, _providedOnChange, doDismiss]
  );
  //#endregion

  //#region public methods
  const handlePresent = useCallback(() => {
    requestAnimationFrame(() => {
      nextIndexRef.current = index;
      setMount(true);
      mountSheet(key, ref);
    });
  }, [key, mountSheet, ref, index]);
  const handleDismiss = useCallback(
    (force: boolean = false) => {
      if (force) {
        if (isMinimized.current) {
          doDismiss();
          return;
        }
        isForcedDismissed.current = true;
        isMinimized.current = false;
      } else {
        willUnmountSheet(key);
      }
      nextIndexRef.current = -1;
      bottomSheetRef.current?.close();
    },
    [key, doDismiss, willUnmountSheet]
  );
  const handleClose = useCallback(() => {
    if (isMinimized.current) {
      return;
    }
    nextIndexRef.current = -1;
    bottomSheetRef.current?.close();
  }, []);
  const handleCollapse = useCallback(() => {
    if (isMinimized.current) {
      return;
    }
    nextIndexRef.current = dismissOnPanDown ? 1 : 0;
    bottomSheetRef.current?.snapTo(nextIndexRef.current);
  }, [dismissOnPanDown]);
  const handleExpand = useCallback(() => {
    if (isMinimized.current) {
      return;
    }
    nextIndexRef.current = snapPoints.length - 1;
    bottomSheetRef.current?.expand();
  }, [snapPoints]);
  const handleSnapTo = useCallback(
    (_index: number) => {
      if (isMinimized.current) {
        return;
      }
      nextIndexRef.current = _index + (dismissOnPanDown ? 1 : 0);
      bottomSheetRef.current?.snapTo(nextIndexRef.current);
    },
    [dismissOnPanDown]
  );
  //#endregion

  //#region private methods
  const handleMinimize = useCallback(() => {
    if (!isMinimized.current) {
      isMinimized.current = true;
      bottomSheetRef.current?.close();
    }
  }, []);
  const handleRestore = useCallback(() => {
    if (isMinimized.current) {
      isMinimized.current = false;
      bottomSheetRef.current?.snapTo(nextIndexRef.current, true);
    }
  }, []);
  const handleOnUnmount = useCallback(() => {
    if (currentIndexRef.current !== -1) {
      handleDismiss(true);
    }
  }, [handleDismiss]);
  //#endregion

  //#region expose public methods
  useImperativeHandle(ref, () => ({
    present: handlePresent,
    dismiss: handleDismiss,
    close: handleClose,
    snapTo: handleSnapTo,
    expand: handleExpand,
    collapse: handleCollapse,
    // private
    minimize: handleMinimize,
    restore: handleRestore,
  }));
  //#endregion

  // render
  return mount ? (
    <Portal key={key} name={key} handleOnUnmount={handleOnUnmount}>
      <BottomSheet
        {...bottomSheetProps}
        ref={bottomSheetRef}
        key={key}
        index={index}
        snapPoints={snapPoints}
        animateOnMount={true}
        topInset={topInset}
        bottomInset={bottomInset}
        containerHeight={safeContainerHeight}
        onChange={handleOnChange}
        children={children}
      />
    </Portal>
  ) : null;
});

const BottomSheetModal = memo(BottomSheetModalComponent, isEqual);

export default BottomSheetModal;
