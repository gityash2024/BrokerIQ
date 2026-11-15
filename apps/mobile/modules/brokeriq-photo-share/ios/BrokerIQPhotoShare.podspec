Pod::Spec.new do |s|
  s.name = 'BrokerIQPhotoShare'
  s.version = '1.0.0'
  s.summary = 'Native BrokerIQ property photo sharing'
  s.license = { :type => 'Proprietary' }
  s.author = 'BrokerIQ'
  s.homepage = 'https://brokeriq.mymultimeds.com'
  s.platform = :ios, '16.4'
  s.swift_version = '5.9'
  s.source = { :git => 'https://github.com/gityash2024/BrokerIQ.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
