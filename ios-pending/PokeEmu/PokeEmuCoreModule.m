#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(PokeEmuCoreModule, RCTEventEmitter)

RCT_EXTERN_METHOD(loadROM:(NSString *)path withResolver:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(unloadROM:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(play)
RCT_EXTERN_METHOD(pause)
RCT_EXTERN_METHOD(setButtonState:(NSString *)button pressed:(BOOL)pressed)
RCT_EXTERN_METHOD(setFastForward:(BOOL)enabled speedMultiplier:(double)speedMultiplier)
RCT_EXTERN_METHOD(saveState:(NSString *)romId slotIndex:(nonnull NSNumber *)slotIndex withResolver:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(loadState:(NSString *)romId slotIndex:(nonnull NSNumber *)slotIndex withResolver:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(applyCheat:(NSString *)code enabled:(BOOL)enabled withResolver:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(removeAllCheats)

@end
