// InDesign yerleşik ($ID/) stil tanımları — GERÇEK KDY şablonundan
// (KDY-sablon-130x195.idml → Resources/Styles.xml) BİREBİR alınmıştır; elle
// değiştirme. Sayfa öğeleri bu tanımlara başvurur (frame → ObjectStyle/$ID/
// [Normal Text Frame], sayfa → TrapPreset/$ID/kDefaultTrapStyleName). Pakette
// TANIMLI olmazlarsa InDesign çerçeveleri sessizce atar → "dosya açılıyor ama
// metin yok" hatası (kullanıcıda görüldü, bu dosya o düzeltmenin parçası).
export const IDML_BUILTIN_STYLE_DEFS = `
	<RootCellStyleGroup Self="u7f">
		<CellStyle Self="CellStyle/$ID/[None]" AppliedParagraphStyle="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[None]" />
	</RootCellStyleGroup>
	<RootTableStyleGroup Self="u81">
		<TableStyle Self="TableStyle/$ID/[No table style]" GraphicLeftInset="0" GraphicTopInset="0" GraphicRightInset="0" GraphicBottomInset="0" ClipContentToGraphicCell="false" TextTopInset="4" TextLeftInset="4" TextBottomInset="4" TextRightInset="4" ClipContentToTextCell="false" Name="$ID/[No table style]" StrokeOrder="BestJoins" TopBorderStrokeWeight="1" TopBorderStrokeType="StrokeStyle/$ID/Solid" TopBorderStrokeColor="Color/Black" TopBorderStrokeTint="100" TopBorderStrokeOverprint="false" TopBorderStrokeGapColor="Color/Paper" TopBorderStrokeGapTint="100" TopBorderStrokeGapOverprint="false" LeftBorderStrokeWeight="1" LeftBorderStrokeType="StrokeStyle/$ID/Solid" LeftBorderStrokeColor="Color/Black" LeftBorderStrokeTint="100" LeftBorderStrokeOverprint="false" LeftBorderStrokeGapColor="Color/Paper" LeftBorderStrokeGapTint="100" LeftBorderStrokeGapOverprint="false" BottomBorderStrokeWeight="1" BottomBorderStrokeType="StrokeStyle/$ID/Solid" BottomBorderStrokeColor="Color/Black" BottomBorderStrokeTint="100" BottomBorderStrokeOverprint="false" BottomBorderStrokeGapColor="Color/Paper" BottomBorderStrokeGapTint="100" BottomBorderStrokeGapOverprint="false" RightBorderStrokeWeight="1" RightBorderStrokeType="StrokeStyle/$ID/Solid" RightBorderStrokeColor="Color/Black" RightBorderStrokeTint="100" RightBorderStrokeOverprint="false" RightBorderStrokeGapColor="Color/Paper" RightBorderStrokeGapTint="100" RightBorderStrokeGapOverprint="false" SpaceBefore="4" SpaceAfter="-4" SkipFirstAlternatingStrokeRows="0" SkipLastAlternatingStrokeRows="0" StartRowStrokeCount="0" StartRowStrokeColor="Color/Black" StartRowStrokeWeight="1" StartRowStrokeType="StrokeStyle/$ID/Solid" StartRowStrokeTint="100" StartRowStrokeGapOverprint="false" StartRowStrokeGapColor="Color/Paper" StartRowStrokeGapTint="100" StartRowStrokeOverprint="false" EndRowStrokeCount="0" EndRowStrokeColor="Color/Black" EndRowStrokeWeight="0.25" EndRowStrokeType="StrokeStyle/$ID/Solid" EndRowStrokeTint="100" EndRowStrokeOverprint="false" EndRowStrokeGapColor="Color/Paper" EndRowStrokeGapTint="100" EndRowStrokeGapOverprint="false" SkipFirstAlternatingStrokeColumns="0" SkipLastAlternatingStrokeColumns="0" StartColumnStrokeCount="0" StartColumnStrokeColor="Color/Black" StartColumnStrokeWeight="1" StartColumnStrokeType="StrokeStyle/$ID/Solid" StartColumnStrokeTint="100" StartColumnStrokeOverprint="false" StartColumnStrokeGapColor="Color/Paper" StartColumnStrokeGapTint="100" StartColumnStrokeGapOverprint="false" EndColumnStrokeCount="0" EndColumnStrokeColor="Color/Black" EndColumnStrokeWeight="0.25" EndColumnLineStyle="StrokeStyle/$ID/Solid" EndColumnStrokeTint="100" EndColumnStrokeOverprint="false" EndColumnStrokeGapColor="Color/Paper" EndColumnStrokeGapTint="100" EndColumnStrokeGapOverprint="false" ColumnFillsPriority="false" SkipFirstAlternatingFillRows="0" SkipLastAlternatingFillRows="0" StartRowFillColor="Color/Black" StartRowFillCount="0" StartRowFillTint="20" StartRowFillOverprint="false" EndRowFillCount="0" EndRowFillColor="Swatch/None" EndRowFillTint="100" EndRowFillOverprint="false" SkipFirstAlternatingFillColumns="0" SkipLastAlternatingFillColumns="0" StartColumnFillCount="0" StartColumnFillColor="Color/Black" StartColumnFillTint="20" StartColumnFillOverprint="false" EndColumnFillCount="0" EndColumnFillColor="Swatch/None" EndColumnFillTint="100" EndColumnFillOverprint="false" HeaderRegionSameAsBodyRegion="true" FooterRegionSameAsBodyRegion="true" LeftColumnRegionSameAsBodyRegion="true" RightColumnRegionSameAsBodyRegion="true" HeaderRegionCellStyle="n" FooterRegionCellStyle="n" LeftColumnRegionCellStyle="n" RightColumnRegionCellStyle="n" BodyRegionCellStyle="CellStyle/$ID/[None]" />
		<TableStyle Self="TableStyle/$ID/[Basic Table]" ExtendedKeyboardShortcut="0 0 0" Name="$ID/[Basic Table]" KeyboardShortcut="0 0">
			<Properties>
				<BasedOn type="string">$ID/[No table style]</BasedOn>
			</Properties>
		</TableStyle>
	</RootTableStyleGroup>
	<RootObjectStyleGroup Self="u8a">
		<ObjectStyle Self="ObjectStyle/$ID/[None]" TopLeftCornerOption="None" TopRightCornerOption="None" BottomLeftCornerOption="None" BottomRightCornerOption="None" TopLeftCornerRadius="12" TopRightCornerRadius="12" BottomLeftCornerRadius="12" BottomRightCornerRadius="12" EmitCss="true" IncludeClass="true" Name="$ID/[None]" AppliedParagraphStyle="ParagraphStyle/$ID/[No paragraph style]" CornerRadius="12" FillColor="Swatch/None" FillTint="-1" StrokeWeight="0" MiterLimit="4" EndCap="ButtEndCap" EndJoin="MiterEndJoin" StrokeType="StrokeStyle/$ID/Solid" LeftLineEnd="None" RightLineEnd="None" StrokeColor="Swatch/None" StrokeTint="-1" GapColor="Swatch/None" GapTint="-1" StrokeAlignment="CenterAlignment" Nonprinting="false" GradientFillAngle="0" GradientStrokeAngle="0" AppliedNamedGrid="n" CornerOption="None" ArrowHeadAlignment="InsidePath" LeftArrowHeadScale="100" RightArrowHeadScale="100">
			<TransformAttributeOption TransformAttrLeftReference="PageEdgeReference" TransformAttrTopReference="PageEdgeReference" TransformAttrRefAnchorPoint="TopLeftAnchor" />
			<ObjectExportOption AltTextSourceType="SourceXMLStructure" ActualTextSourceType="SourceXMLStructure" CustomAltText="$ID/" CustomActualText="$ID/" ApplyTagType="TagFromStructure" ImageConversionType="JPEG" ImageExportResolution="Ppi300" GIFOptionsPalette="AdaptivePalette" GIFOptionsInterlaced="true" JPEGOptionsQuality="High" JPEGOptionsFormat="BaselineEncoding" ImageAlignment="AlignLeft" ImageSpaceBefore="0" ImageSpaceAfter="0" UseImagePageBreak="false" ImagePageBreak="PageBreakBefore" CustomImageAlignment="false" SpaceUnit="CssPixel" CustomLayout="false" CustomLayoutType="AlignmentAndSpacing" EpubType="$ID/" SizeType="DefaultSize" CustomSize="$ID/" PreserveAppearanceFromLayout="PreserveAppearanceDefault">
				<Properties>
					<AltMetadataProperty NamespacePrefix="$ID/" PropertyPath="$ID/" />
					<ActualMetadataProperty NamespacePrefix="$ID/" PropertyPath="$ID/" />
				</Properties>
			</ObjectExportOption>
			<TextFramePreference FootnotesEnableOverrides="false" FootnotesSpanAcrossColumns="false" FootnotesMinimumSpacing="12" FootnotesSpaceBetween="6" TextColumnCount="1" TextColumnGutter="12" TextColumnFixedWidth="144" UseFixedColumnWidth="false" FirstBaselineOffset="AscentOffset" MinimumFirstBaselineOffset="0" VerticalJustification="TopAlign" VerticalThreshold="0" IgnoreWrap="false" VerticalBalanceColumns="false" UseFlexibleColumnWidth="false" TextColumnMaxWidth="0" AutoSizingType="Off" AutoSizingReferencePoint="CenterPoint" UseMinimumHeightForAutoSizing="false" MinimumHeightForAutoSizing="0" UseMinimumWidthForAutoSizing="false" MinimumWidthForAutoSizing="0" UseNoLineBreaksForAutoSizing="false" ColumnRuleOverride="false" ColumnRuleOffset="0" ColumnRuleTopInset="0" ColumnRuleInsetChainOverride="true" ColumnRuleBottomInset="0" ColumnRuleStrokeWidth="1" ColumnRuleStrokeColor="Color/Black" ColumnRuleStrokeType="StrokeStyle/$ID/Solid" ColumnRuleStrokeTint="100" ColumnRuleOverprintOverride="false">
				<Properties>
					<InsetSpacing type="list">
						<ListItem type="unit">0</ListItem>
						<ListItem type="unit">0</ListItem>
						<ListItem type="unit">0</ListItem>
						<ListItem type="unit">0</ListItem>
					</InsetSpacing>
				</Properties>
			</TextFramePreference>
			<BaselineFrameGridOption UseCustomBaselineFrameGrid="false" StartingOffsetForBaselineFrameGrid="0" BaselineFrameGridRelativeOption="TopOfInset" BaselineFrameGridIncrement="12">
				<Properties>
					<BaselineFrameGridColor type="enumeration">LightBlue</BaselineFrameGridColor>
				</Properties>
			</BaselineFrameGridOption>
			<AnchoredObjectSetting AnchoredPosition="InlinePosition" SpineRelative="false" LockPosition="false" PinPosition="true" AnchorPoint="BottomRightAnchor" HorizontalAlignment="LeftAlign" HorizontalReferencePoint="TextFrame" VerticalAlignment="BottomAlign" VerticalReferencePoint="LineBaseline" AnchorXoffset="0" AnchorYoffset="0" AnchorSpaceAbove="0" />
			<TextWrapPreference Inverse="false" ApplyToMasterPageOnly="false" TextWrapSide="BothSides" TextWrapMode="None">
				<Properties>
					<TextWrapOffset Top="0" Left="0" Bottom="0" Right="0" />
				</Properties>
				<ContourOption ContourType="SameAsClipping" IncludeInsideEdges="false" ContourPathName="$ID/" />
			</TextWrapPreference>
			<StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="TextFrameType" StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection" />
			<FrameFittingOption AutoFit="false" LeftCrop="0" TopCrop="0" RightCrop="0" BottomCrop="0" FittingOnEmptyFrame="None" FittingAlignment="CenterAnchor" />
			<TextFrameFootnoteOptionsObject EnableOverrides="false" SpanFootnotesAcross="false" MinimumSpacingOption="12" SpaceBetweenFootnotes="6" />
		</ObjectStyle>
		<ObjectStyle Self="ObjectStyle/$ID/[Normal Graphics Frame]" EnableTransformAttributes="false" TopLeftCornerOption="None" TopRightCornerOption="None" BottomLeftCornerOption="None" BottomRightCornerOption="None" TopLeftCornerRadius="12" TopRightCornerRadius="12" BottomLeftCornerRadius="12" BottomRightCornerRadius="12" EmitCss="true" IncludeClass="true" EnableTextFrameAutoSizingOptions="false" ExtendedKeyboardShortcut="0 0 0" EnableExportTagging="false" EnableObjectExportAltTextOptions="false" EnableObjectExportTaggedPdfOptions="false" EnableObjectExportEpubOptions="false" Name="$ID/[Normal Graphics Frame]" AppliedParagraphStyle="ParagraphStyle/$ID/[No paragraph style]" ApplyNextParagraphStyle="false" EnableFill="true" EnableStroke="true" EnableParagraphStyle="false" EnableTextFrameGeneralOptions="false" EnableTextFrameBaselineOptions="false" EnableStoryOptions="false" EnableTextWrapAndOthers="false" EnableAnchoredObjectOptions="false" CornerRadius="12" FillColor="Swatch/None" FillTint="-1" StrokeWeight="1" MiterLimit="4" EndCap="ButtEndCap" EndJoin="MiterEndJoin" StrokeType="StrokeStyle/$ID/Solid" LeftLineEnd="None" RightLineEnd="None" StrokeColor="Color/Black" StrokeTint="-1" OverprintStroke="false" GapColor="Swatch/None" GapTint="-1" StrokeAlignment="CenterAlignment" Nonprinting="false" GradientFillAngle="0" GradientStrokeAngle="0" AppliedNamedGrid="n" KeyboardShortcut="0 0" EnableFrameFittingOptions="false" CornerOption="None" EnableStrokeAndCornerOptions="true" ArrowHeadAlignment="InsidePath" LeftArrowHeadScale="100" RightArrowHeadScale="100" EnableTextFrameFootnoteOptions="false">
			<Properties>
				<BasedOn type="string">$ID/[None]</BasedOn>
			</Properties>
			<TransformAttributeOption TransformAttrLeftReference="PageEdgeReference" TransformAttrTopReference="PageEdgeReference" TransformAttrRefAnchorPoint="TopLeftAnchor" />
			<ObjectExportOption AltTextSourceType="SourceXMLStructure" ActualTextSourceType="SourceXMLStructure" CustomAltText="$ID/" CustomActualText="$ID/" ApplyTagType="TagFromStructure" ImageConversionType="JPEG" ImageExportResolution="Ppi300" GIFOptionsPalette="AdaptivePalette" GIFOptionsInterlaced="true" JPEGOptionsQuality="High" JPEGOptionsFormat="BaselineEncoding" ImageAlignment="AlignLeft" ImageSpaceBefore="0" ImageSpaceAfter="0" UseImagePageBreak="false" ImagePageBreak="PageBreakBefore" CustomImageAlignment="false" SpaceUnit="CssPixel" CustomLayout="false" CustomLayoutType="AlignmentAndSpacing" EpubType="$ID/" SizeType="DefaultSize" CustomSize="$ID/" PreserveAppearanceFromLayout="PreserveAppearanceDefault">
				<Properties>
					<AltMetadataProperty NamespacePrefix="$ID/" PropertyPath="$ID/" />
					<ActualMetadataProperty NamespacePrefix="$ID/" PropertyPath="$ID/" />
				</Properties>
			</ObjectExportOption>
			<TextFramePreference FootnotesEnableOverrides="false" FootnotesSpanAcrossColumns="false" FootnotesMinimumSpacing="12" FootnotesSpaceBetween="6" TextColumnCount="1" TextColumnGutter="12" TextColumnFixedWidth="144" UseFixedColumnWidth="false" FirstBaselineOffset="AscentOffset" MinimumFirstBaselineOffset="0" VerticalJustification="TopAlign" VerticalThreshold="0" IgnoreWrap="false" VerticalBalanceColumns="false" UseFlexibleColumnWidth="false" TextColumnMaxWidth="0" AutoSizingType="Off" AutoSizingReferencePoint="CenterPoint" UseMinimumHeightForAutoSizing="false" MinimumHeightForAutoSizing="0" UseMinimumWidthForAutoSizing="false" MinimumWidthForAutoSizing="0" UseNoLineBreaksForAutoSizing="false" ColumnRuleOverride="false" ColumnRuleOffset="0" ColumnRuleTopInset="0" ColumnRuleInsetChainOverride="true" ColumnRuleBottomInset="0" ColumnRuleStrokeWidth="0" ColumnRuleStrokeColor="n" ColumnRuleStrokeType="StrokeStyle/$ID/Solid" ColumnRuleStrokeTint="100" ColumnRuleOverprintOverride="false">
				<Properties>
					<InsetSpacing type="list">
						<ListItem type="unit">0</ListItem>
						<ListItem type="unit">0</ListItem>
						<ListItem type="unit">0</ListItem>
						<ListItem type="unit">0</ListItem>
					</InsetSpacing>
				</Properties>
			</TextFramePreference>
			<BaselineFrameGridOption UseCustomBaselineFrameGrid="false" StartingOffsetForBaselineFrameGrid="0" BaselineFrameGridRelativeOption="TopOfInset" BaselineFrameGridIncrement="12">
				<Properties>
					<BaselineFrameGridColor type="enumeration">LightBlue</BaselineFrameGridColor>
				</Properties>
			</BaselineFrameGridOption>
			<AnchoredObjectSetting AnchoredPosition="InlinePosition" SpineRelative="false" LockPosition="false" PinPosition="true" AnchorPoint="BottomRightAnchor" HorizontalAlignment="LeftAlign" HorizontalReferencePoint="TextFrame" VerticalAlignment="BottomAlign" VerticalReferencePoint="LineBaseline" AnchorXoffset="0" AnchorYoffset="0" AnchorSpaceAbove="0" />
			<TextWrapPreference Inverse="false" ApplyToMasterPageOnly="false" TextWrapSide="BothSides" TextWrapMode="None">
				<Properties>
					<TextWrapOffset Top="0" Left="0" Bottom="0" Right="0" />
				</Properties>
				<ContourOption ContourType="SameAsClipping" IncludeInsideEdges="false" ContourPathName="$ID/" />
			</TextWrapPreference>
			<StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="Unknown" StoryOrientation="Unknown" StoryDirection="UnknownDirection" />
			<FrameFittingOption AutoFit="false" LeftCrop="0" TopCrop="0" RightCrop="0" BottomCrop="0" FittingOnEmptyFrame="None" FittingAlignment="CenterAnchor" />
			<ObjectStyleObjectEffectsCategorySettings EnableTransparency="true" EnableDropShadow="true" EnableFeather="true" EnableInnerShadow="true" EnableOuterGlow="true" EnableInnerGlow="true" EnableBevelEmboss="true" EnableSatin="true" EnableDirectionalFeather="true" EnableGradientFeather="true" />
			<ObjectStyleStrokeEffectsCategorySettings EnableTransparency="true" EnableDropShadow="true" EnableFeather="true" EnableInnerShadow="true" EnableOuterGlow="true" EnableInnerGlow="true" EnableBevelEmboss="true" EnableSatin="true" EnableDirectionalFeather="true" EnableGradientFeather="true" />
			<ObjectStyleFillEffectsCategorySettings EnableTransparency="true" EnableDropShadow="true" EnableFeather="true" EnableInnerShadow="true" EnableOuterGlow="true" EnableInnerGlow="true" EnableBevelEmboss="true" EnableSatin="true" EnableDirectionalFeather="true" EnableGradientFeather="true" />
			<ObjectStyleContentEffectsCategorySettings EnableTransparency="true" EnableDropShadow="true" EnableFeather="true" EnableInnerShadow="true" EnableOuterGlow="true" EnableInnerGlow="true" EnableBevelEmboss="true" EnableSatin="true" EnableDirectionalFeather="true" EnableGradientFeather="true" />
			<TextFrameFootnoteOptionsObject EnableOverrides="false" SpanFootnotesAcross="false" MinimumSpacingOption="12" SpaceBetweenFootnotes="6" />
		</ObjectStyle>
		<ObjectStyle Self="ObjectStyle/$ID/[Normal Text Frame]" EnableTransformAttributes="false" TopLeftCornerOption="None" TopRightCornerOption="None" BottomLeftCornerOption="None" BottomRightCornerOption="None" TopLeftCornerRadius="12" TopRightCornerRadius="12" BottomLeftCornerRadius="12" BottomRightCornerRadius="12" EmitCss="true" IncludeClass="true" EnableTextFrameAutoSizingOptions="true" ExtendedKeyboardShortcut="0 0 0" EnableExportTagging="false" EnableObjectExportAltTextOptions="false" EnableObjectExportTaggedPdfOptions="false" EnableObjectExportEpubOptions="false" Name="$ID/[Normal Text Frame]" AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle" ApplyNextParagraphStyle="false" EnableFill="true" EnableStroke="true" EnableParagraphStyle="false" EnableTextFrameGeneralOptions="true" EnableTextFrameBaselineOptions="true" EnableStoryOptions="false" EnableTextWrapAndOthers="false" EnableAnchoredObjectOptions="false" CornerRadius="12" FillColor="Swatch/None" FillTint="-1" StrokeWeight="0" MiterLimit="4" EndCap="ButtEndCap" EndJoin="MiterEndJoin" StrokeType="StrokeStyle/$ID/Solid" LeftLineEnd="None" RightLineEnd="None" StrokeColor="Swatch/None" StrokeTint="-1" GapColor="Swatch/None" GapTint="-1" StrokeAlignment="CenterAlignment" Nonprinting="false" GradientFillAngle="0" GradientStrokeAngle="0" AppliedNamedGrid="n" KeyboardShortcut="0 0" EnableFrameFittingOptions="false" CornerOption="None" EnableStrokeAndCornerOptions="true" ArrowHeadAlignment="InsidePath" LeftArrowHeadScale="100" RightArrowHeadScale="100" EnableTextFrameFootnoteOptions="false">
			<Properties>
				<BasedOn type="string">$ID/[None]</BasedOn>
			</Properties>
			<TransformAttributeOption TransformAttrLeftReference="PageEdgeReference" TransformAttrTopReference="PageEdgeReference" TransformAttrRefAnchorPoint="TopLeftAnchor" />
			<ObjectExportOption AltTextSourceType="SourceXMLStructure" ActualTextSourceType="SourceXMLStructure" CustomAltText="$ID/" CustomActualText="$ID/" ApplyTagType="TagFromStructure" ImageConversionType="JPEG" ImageExportResolution="Ppi300" GIFOptionsPalette="AdaptivePalette" GIFOptionsInterlaced="true" JPEGOptionsQuality="High" JPEGOptionsFormat="BaselineEncoding" ImageAlignment="AlignLeft" ImageSpaceBefore="0" ImageSpaceAfter="0" UseImagePageBreak="false" ImagePageBreak="PageBreakBefore" CustomImageAlignment="false" SpaceUnit="CssPixel" CustomLayout="false" CustomLayoutType="AlignmentAndSpacing" EpubType="$ID/" SizeType="DefaultSize" CustomSize="$ID/" PreserveAppearanceFromLayout="PreserveAppearanceDefault">
				<Properties>
					<AltMetadataProperty NamespacePrefix="$ID/" PropertyPath="$ID/" />
					<ActualMetadataProperty NamespacePrefix="$ID/" PropertyPath="$ID/" />
				</Properties>
			</ObjectExportOption>
			<TextFramePreference FootnotesEnableOverrides="false" FootnotesSpanAcrossColumns="false" FootnotesMinimumSpacing="12" FootnotesSpaceBetween="6" TextColumnCount="1" TextColumnGutter="12" TextColumnFixedWidth="144" UseFixedColumnWidth="false" FirstBaselineOffset="AscentOffset" MinimumFirstBaselineOffset="0" VerticalJustification="TopAlign" VerticalThreshold="0" IgnoreWrap="false" VerticalBalanceColumns="false" UseFlexibleColumnWidth="false" TextColumnMaxWidth="0" AutoSizingType="Off" AutoSizingReferencePoint="CenterPoint" UseMinimumHeightForAutoSizing="false" MinimumHeightForAutoSizing="0" UseMinimumWidthForAutoSizing="false" MinimumWidthForAutoSizing="0" UseNoLineBreaksForAutoSizing="false" ColumnRuleOverride="false" ColumnRuleOffset="0" ColumnRuleTopInset="0" ColumnRuleInsetChainOverride="true" ColumnRuleBottomInset="0" ColumnRuleStrokeWidth="0" ColumnRuleStrokeColor="n" ColumnRuleStrokeType="StrokeStyle/$ID/Solid" ColumnRuleStrokeTint="100" ColumnRuleOverprintOverride="false">
				<Properties>
					<InsetSpacing type="list">
						<ListItem type="unit">0</ListItem>
						<ListItem type="unit">0</ListItem>
						<ListItem type="unit">0</ListItem>
						<ListItem type="unit">0</ListItem>
					</InsetSpacing>
				</Properties>
			</TextFramePreference>
			<BaselineFrameGridOption UseCustomBaselineFrameGrid="false" StartingOffsetForBaselineFrameGrid="0" BaselineFrameGridRelativeOption="TopOfInset" BaselineFrameGridIncrement="12">
				<Properties>
					<BaselineFrameGridColor type="enumeration">LightBlue</BaselineFrameGridColor>
				</Properties>
			</BaselineFrameGridOption>
			<AnchoredObjectSetting AnchoredPosition="InlinePosition" SpineRelative="false" LockPosition="false" PinPosition="true" AnchorPoint="BottomRightAnchor" HorizontalAlignment="LeftAlign" HorizontalReferencePoint="TextFrame" VerticalAlignment="BottomAlign" VerticalReferencePoint="LineBaseline" AnchorXoffset="0" AnchorYoffset="0" AnchorSpaceAbove="0" />
			<TextWrapPreference Inverse="false" ApplyToMasterPageOnly="false" TextWrapSide="BothSides" TextWrapMode="None">
				<Properties>
					<TextWrapOffset Top="0" Left="0" Bottom="0" Right="0" />
				</Properties>
				<ContourOption ContourType="SameAsClipping" IncludeInsideEdges="false" ContourPathName="$ID/" />
			</TextWrapPreference>
			<StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="TextFrameType" StoryOrientation="Unknown" StoryDirection="LeftToRightDirection" />
			<FrameFittingOption AutoFit="false" LeftCrop="0" TopCrop="0" RightCrop="0" BottomCrop="0" FittingOnEmptyFrame="None" FittingAlignment="CenterAnchor" />
			<ObjectStyleObjectEffectsCategorySettings EnableTransparency="true" EnableDropShadow="true" EnableFeather="true" EnableInnerShadow="true" EnableOuterGlow="true" EnableInnerGlow="true" EnableBevelEmboss="true" EnableSatin="true" EnableDirectionalFeather="true" EnableGradientFeather="true" />
			<ObjectStyleStrokeEffectsCategorySettings EnableTransparency="true" EnableDropShadow="true" EnableFeather="true" EnableInnerShadow="true" EnableOuterGlow="true" EnableInnerGlow="true" EnableBevelEmboss="true" EnableSatin="true" EnableDirectionalFeather="true" EnableGradientFeather="true" />
			<ObjectStyleFillEffectsCategorySettings EnableTransparency="true" EnableDropShadow="true" EnableFeather="true" EnableInnerShadow="true" EnableOuterGlow="true" EnableInnerGlow="true" EnableBevelEmboss="true" EnableSatin="true" EnableDirectionalFeather="true" EnableGradientFeather="true" />
			<ObjectStyleContentEffectsCategorySettings EnableTransparency="true" EnableDropShadow="true" EnableFeather="true" EnableInnerShadow="true" EnableOuterGlow="true" EnableInnerGlow="true" EnableBevelEmboss="true" EnableSatin="true" EnableDirectionalFeather="true" EnableGradientFeather="true" />
			<TextFrameFootnoteOptionsObject EnableOverrides="false" SpanFootnotesAcross="false" MinimumSpacingOption="12" SpaceBetweenFootnotes="6" />
		</ObjectStyle>
		<ObjectStyle Self="ObjectStyle/$ID/[Normal Grid]" EnableTransformAttributes="false" TopLeftCornerOption="None" TopRightCornerOption="None" BottomLeftCornerOption="None" BottomRightCornerOption="None" TopLeftCornerRadius="12" TopRightCornerRadius="12" BottomLeftCornerRadius="12" BottomRightCornerRadius="12" EmitCss="true" IncludeClass="true" EnableTextFrameAutoSizingOptions="true" ExtendedKeyboardShortcut="0 0 0" EnableExportTagging="false" EnableObjectExportAltTextOptions="false" EnableObjectExportTaggedPdfOptions="false" EnableObjectExportEpubOptions="false" Name="$ID/[Normal Grid]" AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle" ApplyNextParagraphStyle="false" EnableFill="true" EnableStroke="true" EnableParagraphStyle="false" EnableTextFrameGeneralOptions="true" EnableTextFrameBaselineOptions="true" EnableStoryOptions="true" EnableTextWrapAndOthers="false" EnableAnchoredObjectOptions="false" CornerRadius="12" FillColor="Swatch/None" FillTint="-1" StrokeWeight="0" MiterLimit="4" EndCap="ButtEndCap" EndJoin="MiterEndJoin" StrokeType="StrokeStyle/$ID/Solid" LeftLineEnd="None" RightLineEnd="None" StrokeColor="Swatch/None" StrokeTint="-1" GapColor="Swatch/None" GapTint="-1" StrokeAlignment="CenterAlignment" Nonprinting="false" GradientFillAngle="0" GradientStrokeAngle="0" AppliedNamedGrid="n" KeyboardShortcut="0 0" EnableFrameFittingOptions="false" CornerOption="None" EnableStrokeAndCornerOptions="true" ArrowHeadAlignment="InsidePath" LeftArrowHeadScale="100" RightArrowHeadScale="100" EnableTextFrameFootnoteOptions="false">
			<Properties>
				<BasedOn type="string">$ID/[None]</BasedOn>
			</Properties>
			<TransformAttributeOption TransformAttrLeftReference="PageEdgeReference" TransformAttrTopReference="PageEdgeReference" TransformAttrRefAnchorPoint="TopLeftAnchor" />
			<ObjectExportOption AltTextSourceType="SourceXMLStructure" ActualTextSourceType="SourceXMLStructure" CustomAltText="$ID/" CustomActualText="$ID/" ApplyTagType="TagFromStructure" ImageConversionType="JPEG" ImageExportResolution="Ppi300" GIFOptionsPalette="AdaptivePalette" GIFOptionsInterlaced="true" JPEGOptionsQuality="High" JPEGOptionsFormat="BaselineEncoding" ImageAlignment="AlignLeft" ImageSpaceBefore="0" ImageSpaceAfter="0" UseImagePageBreak="false" ImagePageBreak="PageBreakBefore" CustomImageAlignment="false" SpaceUnit="CssPixel" CustomLayout="false" CustomLayoutType="AlignmentAndSpacing" EpubType="$ID/" SizeType="DefaultSize" CustomSize="$ID/" PreserveAppearanceFromLayout="PreserveAppearanceDefault">
				<Properties>
					<AltMetadataProperty NamespacePrefix="$ID/" PropertyPath="$ID/" />
					<ActualMetadataProperty NamespacePrefix="$ID/" PropertyPath="$ID/" />
				</Properties>
			</ObjectExportOption>
			<TextFramePreference FootnotesEnableOverrides="false" FootnotesSpanAcrossColumns="false" FootnotesMinimumSpacing="12" FootnotesSpaceBetween="6" TextColumnCount="1" TextColumnGutter="12" TextColumnFixedWidth="144" UseFixedColumnWidth="false" FirstBaselineOffset="AscentOffset" MinimumFirstBaselineOffset="0" VerticalJustification="TopAlign" VerticalThreshold="0" IgnoreWrap="false" VerticalBalanceColumns="false" UseFlexibleColumnWidth="false" TextColumnMaxWidth="0" AutoSizingType="Off" AutoSizingReferencePoint="CenterPoint" UseMinimumHeightForAutoSizing="false" MinimumHeightForAutoSizing="0" UseMinimumWidthForAutoSizing="false" MinimumWidthForAutoSizing="0" UseNoLineBreaksForAutoSizing="false" ColumnRuleOverride="false" ColumnRuleOffset="0" ColumnRuleTopInset="0" ColumnRuleInsetChainOverride="true" ColumnRuleBottomInset="0" ColumnRuleStrokeWidth="0" ColumnRuleStrokeColor="n" ColumnRuleStrokeType="StrokeStyle/$ID/Solid" ColumnRuleStrokeTint="100" ColumnRuleOverprintOverride="false">
				<Properties>
					<InsetSpacing type="list">
						<ListItem type="unit">0</ListItem>
						<ListItem type="unit">0</ListItem>
						<ListItem type="unit">0</ListItem>
						<ListItem type="unit">0</ListItem>
					</InsetSpacing>
				</Properties>
			</TextFramePreference>
			<BaselineFrameGridOption UseCustomBaselineFrameGrid="false" StartingOffsetForBaselineFrameGrid="0" BaselineFrameGridRelativeOption="TopOfInset" BaselineFrameGridIncrement="12">
				<Properties>
					<BaselineFrameGridColor type="enumeration">LightBlue</BaselineFrameGridColor>
				</Properties>
			</BaselineFrameGridOption>
			<AnchoredObjectSetting AnchoredPosition="InlinePosition" SpineRelative="false" LockPosition="false" PinPosition="true" AnchorPoint="BottomRightAnchor" HorizontalAlignment="LeftAlign" HorizontalReferencePoint="TextFrame" VerticalAlignment="BottomAlign" VerticalReferencePoint="LineBaseline" AnchorXoffset="0" AnchorYoffset="0" AnchorSpaceAbove="0" />
			<TextWrapPreference Inverse="false" ApplyToMasterPageOnly="false" TextWrapSide="BothSides" TextWrapMode="None">
				<Properties>
					<TextWrapOffset Top="0" Left="0" Bottom="0" Right="0" />
				</Properties>
				<ContourOption ContourType="SameAsClipping" IncludeInsideEdges="false" ContourPathName="$ID/" />
			</TextWrapPreference>
			<StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="FrameGridType" StoryOrientation="Unknown" StoryDirection="LeftToRightDirection" />
			<FrameFittingOption AutoFit="false" LeftCrop="0" TopCrop="0" RightCrop="0" BottomCrop="0" FittingOnEmptyFrame="None" FittingAlignment="CenterAnchor" />
			<ObjectStyleObjectEffectsCategorySettings EnableTransparency="true" EnableDropShadow="true" EnableFeather="true" EnableInnerShadow="true" EnableOuterGlow="true" EnableInnerGlow="true" EnableBevelEmboss="true" EnableSatin="true" EnableDirectionalFeather="true" EnableGradientFeather="true" />
			<ObjectStyleStrokeEffectsCategorySettings EnableTransparency="true" EnableDropShadow="true" EnableFeather="true" EnableInnerShadow="true" EnableOuterGlow="true" EnableInnerGlow="true" EnableBevelEmboss="true" EnableSatin="true" EnableDirectionalFeather="true" EnableGradientFeather="true" />
			<ObjectStyleFillEffectsCategorySettings EnableTransparency="true" EnableDropShadow="true" EnableFeather="true" EnableInnerShadow="true" EnableOuterGlow="true" EnableInnerGlow="true" EnableBevelEmboss="true" EnableSatin="true" EnableDirectionalFeather="true" EnableGradientFeather="true" />
			<ObjectStyleContentEffectsCategorySettings EnableTransparency="true" EnableDropShadow="true" EnableFeather="true" EnableInnerShadow="true" EnableOuterGlow="true" EnableInnerGlow="true" EnableBevelEmboss="true" EnableSatin="true" EnableDirectionalFeather="true" EnableGradientFeather="true" />
			<TextFrameFootnoteOptionsObject EnableOverrides="false" SpanFootnotesAcross="false" MinimumSpacingOption="12" SpaceBetweenFootnotes="6" />
		</ObjectStyle>
	</RootObjectStyleGroup>
	<TrapPreset Self="TrapPreset/$ID/k[No Trap Preset]" Name="$ID/k[No Trap Preset]" DefaultTrapWidth="0.25" BlackWidth="0.5" TrapJoin="MiterEndJoin" TrapEnd="MiterTrapEnds" ObjectsToImages="true" ImagesToImages="true" InternalImages="false" OneBitImages="true" ImagePlacement="CenterEdges" StepThreshold="10" BlackColorThreshold="100" BlackDensity="1.6" SlidingTrapThreshold="70" ColorReduction="100" />
	<TrapPreset Self="TrapPreset/$ID/kDefaultTrapStyleName" Name="$ID/kDefaultTrapStyleName" DefaultTrapWidth="0.25" BlackWidth="0.5" TrapJoin="MiterEndJoin" TrapEnd="MiterTrapEnds" ObjectsToImages="true" ImagesToImages="true" InternalImages="false" OneBitImages="true" ImagePlacement="CenterEdges" StepThreshold="10" BlackColorThreshold="100" BlackDensity="1.6" SlidingTrapThreshold="70" ColorReduction="100" />
`;
