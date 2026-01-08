Pod::Spec.new do |s|
  s.name           = 'BackgroundAudio'
  s.version        = '1.0.0'
  s.summary        = 'Background audio module for iOS'
  s.description    = 'Native iOS module for background audio playback using AVAudioPlayer'
  s.author         = ''
  s.homepage       = 'https://github.com/example/background-audio'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift}'
end
